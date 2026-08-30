import type { Clip, PortableProject, VodReference } from '../projects';

export interface DaVinciTimelineSettings {
  readonly frameRate: number;
  readonly width: number;
  readonly height: number;
}

export interface DaVinciTimelineExport {
  readonly content: string;
  readonly fileName: string;
  readonly timelineDurationFrames: number;
}

interface FrameRateFraction {
  readonly numerator: number;
  readonly denominator: number;
}

export function createDaVinciTimeline(
  project: PortableProject,
  settings: DaVinciTimelineSettings = project.davinciDefaults,
): DaVinciTimelineExport {
  validateSettings(settings);
  const orderedClips = project.clipOrder.map((clipId) => {
    const clip = project.clips.find((candidate) => candidate.id === clipId);
    if (clip === undefined) {
      throw new Error('The stored clip order references a missing clip.');
    }
    return clip;
  });
  if (orderedClips.length === 0) {
    throw new Error('At least one marked clip is required for a DaVinci Resolve timeline.');
  }

  const rate = frameRateFraction(settings.frameRate);
  const usedVodIds = [...new Set(orderedClips.map((clip) => clip.vodId))];
  const vods = usedVodIds.map((vodId) => {
    const vod = project.vods.find((candidate) => candidate.id === vodId);
    if (vod === undefined) {
      throw new Error('A marked clip references a missing source VOD.');
    }
    return vod;
  });
  const resourceIdByVodId = new Map(vods.map((vod, index) => [vod.id, `r${index + 2}`]));
  const sourceFramesByVodId = new Map(
    vods.map((vod) => [vod.id, sourceDurationFrames(vod, orderedClips, rate)]),
  );

  let timelineOffsetFrames = 0;
  const timelineClips = orderedClips.map((clip) => {
    const startFrame = secondsToFrames(clip.inPointSeconds, rate);
    const endFrame = Math.max(startFrame + 1, secondsToFrames(clip.outPointSeconds, rate));
    const durationFrames = endFrame - startFrame;
    const assetClip = `        <asset-clip name="${escapeXml(clip.title)}" ref="${resourceIdByVodId.get(clip.vodId)}" offset="${formatFrameTime(timelineOffsetFrames, rate)}" start="${formatFrameTime(startFrame, rate)}" duration="${formatFrameTime(durationFrames, rate)}" audioRole="dialogue"/>`;
    timelineOffsetFrames += durationFrames;
    return assetClip;
  });

  const resources = vods.map((vod) => {
    const resourceId = resourceIdByVodId.get(vod.id)!;
    return [
      `    <asset id="${resourceId}" name="${escapeXml(vod.fileName)}" start="0s" duration="${formatFrameTime(sourceFramesByVodId.get(vod.id)!, rate)}" hasVideo="1" hasAudio="1" audioSources="1" audioChannels="2" format="r1">`,
      `      <media-rep kind="original-media" src="${escapeXml(toFilenameUri(vod.fileName))}" suggestedFilename="${escapeXml(vod.fileName)}"/>`,
      '    </asset>',
    ].join('\n');
  });
  const projectName = escapeXml(project.name);
  const content = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE fcpxml>',
    '<fcpxml version="1.10">',
    '  <resources>',
    `    <format id="r1" name="BDO VOD Scanner ${settings.width}x${settings.height}" frameDuration="${formatFrameTime(1, rate)}" width="${settings.width}" height="${settings.height}"/>`,
    ...resources,
    '  </resources>',
    '  <library>',
    `    <event name="${projectName}">`,
    `      <project name="${projectName}">`,
    `        <sequence format="r1" duration="${formatFrameTime(timelineOffsetFrames, rate)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">`,
    '          <spine>',
    ...timelineClips,
    '          </spine>',
    '        </sequence>',
    '      </project>',
    '    </event>',
    '  </library>',
    '</fcpxml>',
    '',
  ].join('\n');

  return {
    content,
    fileName: `${sanitizeFileName(project.name)}.fcpxml`,
    timelineDurationFrames: timelineOffsetFrames,
  };
}

function sourceDurationFrames(
  vod: VodReference,
  clips: readonly Clip[],
  rate: FrameRateFraction,
): number {
  const lastClipFrame = clips
    .filter((clip) => clip.vodId === vod.id)
    .reduce((largest, clip) => Math.max(largest, secondsToFrames(clip.outPointSeconds, rate)), 1);
  return Math.max(
    lastClipFrame,
    vod.durationSeconds === null ? 1 : Math.ceil(vod.durationSeconds / frameDuration(rate)),
  );
}

function frameRateFraction(frameRate: number): FrameRateFraction {
  const ntscRates = [23.976, 29.97, 59.94, 119.88];
  const ntscRate = ntscRates.find((candidate) => Math.abs(candidate - frameRate) < 0.001);
  if (ntscRate !== undefined) {
    return { numerator: 1001, denominator: Math.round(ntscRate * 1001) };
  }
  const rounded = Math.round(frameRate);
  if (Math.abs(rounded - frameRate) < 0.000_001) {
    return { numerator: 1, denominator: rounded };
  }
  return reduceFraction(1_000_000, Math.round(frameRate * 1_000_000));
}

function frameDuration(rate: FrameRateFraction): number {
  return rate.numerator / rate.denominator;
}

function secondsToFrames(seconds: number, rate: FrameRateFraction): number {
  return Math.max(0, Math.round(seconds / frameDuration(rate)));
}

function formatFrameTime(frames: number, rate: FrameRateFraction): string {
  if (frames === 0) {
    return '0s';
  }
  const reduced = reduceFraction(frames * rate.numerator, rate.denominator);
  return reduced.denominator === 1
    ? `${reduced.numerator}s`
    : `${reduced.numerator}/${reduced.denominator}s`;
}

function reduceFraction(numerator: number, denominator: number): FrameRateFraction {
  let left = Math.abs(numerator);
  let right = Math.abs(denominator);
  while (right !== 0) {
    [left, right] = [right, left % right];
  }
  const divisor = left || 1;
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function toFilenameUri(fileName: string): string {
  return `file://localhost/${encodeURIComponent(fileName)}`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function sanitizeFileName(value: string): string {
  const sanitized = value
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*]/g, '-')
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 ? '-' : character))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  return sanitized.length > 0 ? sanitized : 'BDO-VOD-Scanner-Timeline';
}

function validateSettings(settings: DaVinciTimelineSettings) {
  if (
    !Number.isFinite(settings.frameRate) ||
    settings.frameRate <= 0 ||
    settings.frameRate > 240 ||
    !Number.isInteger(settings.width) ||
    settings.width <= 0 ||
    settings.width > 16_384 ||
    !Number.isInteger(settings.height) ||
    settings.height <= 0 ||
    settings.height > 16_384
  ) {
    throw new Error('The DaVinci Resolve timeline settings are invalid.');
  }
}
