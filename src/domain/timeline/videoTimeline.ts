export interface TimelineWindow {
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly durationSeconds: number;
}

export function zoomLevelToFactor(level: number): number {
  const safeLevel = Math.min(120, Math.max(1, level));
  return 2 ** ((safeLevel - 1) / 12);
}

export function calculateTimelineWindow(
  mediaDurationSeconds: number,
  centerSeconds: number,
  zoomFactor: number,
): TimelineWindow {
  const duration = finiteNonNegative(mediaDurationSeconds);
  if (duration === 0) {
    return { startSeconds: 0, endSeconds: 0, durationSeconds: 0 };
  }

  const safeZoom = Number.isFinite(zoomFactor) ? Math.max(1, zoomFactor) : 1;
  const visibleDuration = duration / safeZoom;
  const maximumStart = duration - visibleDuration;
  const desiredStart = finiteNonNegative(centerSeconds) - visibleDuration / 2;
  const start = Math.min(maximumStart, Math.max(0, desiredStart));

  return {
    startSeconds: start,
    endSeconds: start + visibleDuration,
    durationSeconds: visibleDuration,
  };
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
