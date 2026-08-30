import { parseBdoLog } from '../../domain/events';
import {
  portableProjectSchema,
  type PortableProject,
  type VodReference,
} from '../../domain/projects';
import {
  hasMp4FileSignature,
  isLogFileName,
  isMp4FileName,
  MAX_RAW_LOG_BYTES,
} from '../../domain/source-import';
import type { InspectedVideoMetadata, VideoMetadataInspector } from '../../infrastructure/media';
import { SourceImportError, type SourceImportIssue, type SourceImportResult } from './types';

const SIGNATURE_BYTES = 32;
const VOD_COUNT_WARNING_THRESHOLD = 8;

export async function importSourceFiles(
  project: PortableProject,
  files: readonly File[],
  metadataInspector: VideoMetadataInspector,
  now = new Date(),
  currentlyLinkedVodIds: ReadonlySet<string> = new Set(),
): Promise<SourceImportResult> {
  if (files.length === 0) {
    throw new SourceImportError('emptySelection');
  }

  const logFiles = files.filter((file) => isLogFileName(file.name));
  if (logFiles.length > 1) {
    throw new SourceImportError('multipleLogs');
  }
  if (logFiles.length === 1 && project.rawLog !== null) {
    throw new SourceImportError('existingLog');
  }

  const issues: SourceImportIssue[] = files
    .filter((file) => !isLogFileName(file.name) && !isMp4FileName(file.name))
    .map((file) => ({ code: 'unsupportedFile', fileName: file.name }));

  let rawLog = project.rawLog;
  let sessionDate = project.sessionDate;
  let importedLog = false;
  let eventCount = 0;
  let logIssueCount = 0;

  const logFile = logFiles[0];
  if (logFile !== undefined) {
    if (logFile.size > MAX_RAW_LOG_BYTES) {
      throw new SourceImportError('logTooLarge');
    }

    const candidateRawLog = await logFile.text();
    try {
      const parsedLog = parseBdoLog(logFile.name, candidateRawLog);
      rawLog = candidateRawLog;
      sessionDate = parsedLog.sessionDate;
      importedLog = true;
      eventCount = parsedLog.events.length;
      logIssueCount = parsedLog.issues.length;
    } catch {
      throw new SourceImportError('invalidLog');
    }
  } else if (rawLog !== null && sessionDate !== null) {
    const parsedLog = parseBdoLog(`${sessionDate}.log`, rawLog);
    eventCount = parsedLog.events.length;
    logIssueCount = parsedLog.issues.length;
  }

  const existingVodsByKey = new Map(project.vods.map((vod) => [getVodDuplicateKey(vod), vod]));
  const vods = [...project.vods];
  const vodFiles = new Map<string, File>();

  for (const file of files.filter((candidate) => isMp4FileName(candidate.name))) {
    const duplicateKey = getFileDuplicateKey(file);
    const signature = new Uint8Array(await file.slice(0, SIGNATURE_BYTES).arrayBuffer());
    if (!hasMp4FileSignature(signature)) {
      issues.push({ code: 'invalidMp4', fileName: file.name });
      continue;
    }

    const existingVod = existingVodsByKey.get(duplicateKey);
    if (existingVod !== undefined) {
      if (currentlyLinkedVodIds.has(existingVod.id) || vodFiles.has(existingVod.id)) {
        issues.push({ code: 'duplicateVod', fileName: file.name });
      } else {
        vodFiles.set(existingVod.id, file);
        issues.push({ code: 'relinkedVod', fileName: file.name });
      }
      continue;
    }

    let metadata = emptyVideoMetadata();
    try {
      metadata = await metadataInspector.inspect(file);
    } catch {
      issues.push({ code: 'metadataUnavailable', fileName: file.name });
    }

    const vod = createVodReference(file, metadata);
    vods.push(vod);
    vodFiles.set(vod.id, file);
    existingVodsByKey.set(duplicateKey, vod);
  }

  const importedVodCount = vods.length - project.vods.length;
  const relinkedVodCount = vodFiles.size - importedVodCount;
  if (!importedLog && importedVodCount === 0 && relinkedVodCount === 0) {
    throw new SourceImportError('noUsableFiles');
  }

  if (vods.length > VOD_COUNT_WARNING_THRESHOLD) {
    issues.push({ code: 'tooManyVods' });
  }

  const largestResolution = findLargestResolution(vods);
  const updatedProject = portableProjectSchema.parse({
    ...project,
    sessionDate,
    rawLog,
    vods,
    updatedAt: importedLog || importedVodCount > 0 ? now.toISOString() : project.updatedAt,
    davinciDefaults:
      largestResolution === undefined
        ? project.davinciDefaults
        : {
            ...project.davinciDefaults,
            width: largestResolution.width,
            height: largestResolution.height,
          },
  });

  return {
    project: updatedProject,
    vodFiles,
    importedLog,
    importedVodCount,
    relinkedVodCount,
    eventCount,
    logIssueCount,
    issues,
  };
}

function createVodReference(file: File, metadata: InspectedVideoMetadata): VodReference {
  return {
    id: crypto.randomUUID(),
    displayName: file.name.replace(/\.mp4$/i, ''),
    fileName: file.name,
    fileSizeBytes: file.size,
    lastModifiedMs: file.lastModified > 0 ? file.lastModified : null,
    durationSeconds: metadata.durationSeconds,
    width: metadata.width,
    height: metadata.height,
    nominalFrameRate: metadata.nominalFrameRate,
    variableFrameRate: metadata.variableFrameRate,
    videoCodec: metadata.videoCodec,
    audioCodec: metadata.audioCodec,
    synchronizationAnchor: null,
    searchTerms: [],
  };
}

function emptyVideoMetadata(): InspectedVideoMetadata {
  return {
    durationSeconds: null,
    width: null,
    height: null,
    nominalFrameRate: null,
    variableFrameRate: null,
    videoCodec: null,
    audioCodec: null,
  };
}

function getVodDuplicateKey(vod: VodReference): string {
  return `${vod.fileName.toLocaleLowerCase('en-US')}\0${vod.fileSizeBytes}\0${vod.lastModifiedMs ?? 0}`;
}

function getFileDuplicateKey(file: File): string {
  return `${file.name.toLocaleLowerCase('en-US')}\0${file.size}\0${file.lastModified}`;
}

function findLargestResolution(
  vods: readonly VodReference[],
): { readonly width: number; readonly height: number } | undefined {
  return vods.reduce<{ readonly width: number; readonly height: number } | undefined>(
    (largest, vod) => {
      if (vod.width === null || vod.height === null) {
        return largest;
      }
      if (largest === undefined || vod.width * vod.height > largest.width * largest.height) {
        return { width: vod.width, height: vod.height };
      }
      return largest;
    },
    undefined,
  );
}
