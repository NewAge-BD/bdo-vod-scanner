import { APP_VERSION, CURRENT_PROJECT_SCHEMA_VERSION, PROJECT_FILE_SUFFIX } from './constants';
import { portableProjectSchema, type PortableProject } from './schema';

export function createProject(name: string, now = new Date()): PortableProject {
  const timestamp = now.toISOString();

  return portableProjectSchema.parse({
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    id: crypto.randomUUID(),
    name,
    sessionDate: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    rawLog: null,
    parserVersion: 2,
    vods: [],
    clips: [],
    clipOrder: [],
    uiState: {
      clipPanelCollapsed: false,
    },
    davinciDefaults: {
      frameRate: 60,
      width: 1920,
      height: 1080,
    },
  });
}

export function renameProject(
  project: PortableProject,
  name: string,
  now = new Date(),
): PortableProject {
  return portableProjectSchema.parse({
    ...project,
    name,
    updatedAt: now.toISOString(),
  });
}

export function renameVod(
  project: PortableProject,
  vodId: string,
  displayName: string,
  now = new Date(),
): PortableProject {
  if (!project.vods.some((vod) => vod.id === vodId)) {
    throw new Error('The selected VOD does not exist in this project.');
  }
  return portableProjectSchema.parse({
    ...project,
    updatedAt: now.toISOString(),
    vods: project.vods.map((vod) => (vod.id === vodId ? { ...vod, displayName } : vod)),
  });
}

export function setDavinciDefaults(
  project: PortableProject,
  defaults: PortableProject['davinciDefaults'],
  now = new Date(),
): PortableProject {
  return portableProjectSchema.parse({
    ...project,
    updatedAt: now.toISOString(),
    davinciDefaults: defaults,
  });
}

export function setVodSearchTerms(
  project: PortableProject,
  vodId: string,
  searchTerms: readonly string[],
  now = new Date(),
): PortableProject {
  if (!project.vods.some((vod) => vod.id === vodId)) {
    throw new Error('The selected VOD does not exist in this project.');
  }
  const normalizedTerms = normalizeSearchTerms(searchTerms);

  return portableProjectSchema.parse({
    ...project,
    updatedAt: now.toISOString(),
    vods: project.vods.map((vod) =>
      vod.id === vodId
        ? {
            ...vod,
            searchTerms: normalizedTerms,
            splitSearchTerms: (vod.splitSearchTerms ?? []).filter((term) =>
              includesSearchTerm(normalizedTerms, term),
            ),
          }
        : vod,
    ),
  });
}

export function setVodSplitSearchTerms(
  project: PortableProject,
  vodId: string,
  splitSearchTerms: readonly string[],
  now = new Date(),
): PortableProject {
  const vod = project.vods.find((candidate) => candidate.id === vodId);
  if (vod === undefined) {
    throw new Error('The selected VOD does not exist in this project.');
  }
  const normalizedTerms = normalizeSearchTerms(splitSearchTerms).filter((term) =>
    includesSearchTerm(vod.searchTerms, term),
  );

  return portableProjectSchema.parse({
    ...project,
    updatedAt: now.toISOString(),
    vods: project.vods.map((candidate) =>
      candidate.id === vodId ? { ...candidate, splitSearchTerms: normalizedTerms } : candidate,
    ),
  });
}

function normalizeSearchTerms(searchTerms: readonly string[]): readonly string[] {
  return searchTerms
    .map((term) => term.trim())
    .filter((term, index, terms) => {
      return (
        term.length > 0 &&
        terms.findIndex(
          (candidate) => candidate.toLocaleLowerCase() === term.toLocaleLowerCase(),
        ) === index
      );
    });
}

function includesSearchTerm(searchTerms: readonly string[], term: string): boolean {
  return searchTerms.some(
    (candidate) => candidate.toLocaleLowerCase() === term.toLocaleLowerCase(),
  );
}

export function deleteProjectVod(
  project: PortableProject,
  vodId: string,
  now = new Date(),
): PortableProject {
  if (!project.vods.some((vod) => vod.id === vodId)) {
    throw new Error('The selected VOD does not exist in this project.');
  }
  const removedClipIds = new Set(
    project.clips.filter((clip) => clip.vodId === vodId).map((clip) => clip.id),
  );

  return portableProjectSchema.parse({
    ...project,
    updatedAt: now.toISOString(),
    vods: project.vods.filter((vod) => vod.id !== vodId),
    clips: project.clips.filter((clip) => clip.vodId !== vodId),
    clipOrder: project.clipOrder.filter((clipId) => !removedClipIds.has(clipId)),
  });
}

export function getProjectExportFileName(project: PortableProject): string {
  const nameWithoutReservedCharacters = project.name
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*]/g, '-')
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 ? '-' : character))
    .join('');
  const safeName = nameWithoutReservedCharacters
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');

  return `${safeName.length > 0 ? safeName : 'project'}${PROJECT_FILE_SUFFIX}`;
}
