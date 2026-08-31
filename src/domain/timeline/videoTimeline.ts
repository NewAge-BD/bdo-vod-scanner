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

export function calculatePointerAnchoredZoomCenter(
  mediaDurationSeconds: number,
  currentWindow: TimelineWindow,
  nextZoomFactor: number,
  pointerRatio: number,
): number {
  const duration = finiteNonNegative(mediaDurationSeconds);
  if (duration === 0) {
    return 0;
  }
  const safeRatio = Number.isFinite(pointerRatio) ? Math.min(1, Math.max(0, pointerRatio)) : 0.5;
  const safeZoom = Number.isFinite(nextZoomFactor) ? Math.max(1, nextZoomFactor) : 1;
  const nextVisibleDuration = duration / safeZoom;
  const anchorTime = currentWindow.startSeconds + currentWindow.durationSeconds * safeRatio;
  const maximumStart = duration - nextVisibleDuration;
  const nextStart = Math.min(
    maximumStart,
    Math.max(0, anchorTime - nextVisibleDuration * safeRatio),
  );
  return nextStart + nextVisibleDuration / 2;
}

export function calculateTimelineNavigatorCenter(
  mediaDurationSeconds: number,
  visibleDurationSeconds: number,
  pointerRatio: number,
  grabOffsetSeconds: number,
): number {
  const duration = finiteNonNegative(mediaDurationSeconds);
  if (duration === 0) {
    return 0;
  }
  const visibleDuration = Math.min(duration, finiteNonNegative(visibleDurationSeconds));
  const safeRatio = Number.isFinite(pointerRatio) ? Math.min(1, Math.max(0, pointerRatio)) : 0.5;
  const safeGrabOffset = Number.isFinite(grabOffsetSeconds)
    ? Math.min(visibleDuration, Math.max(0, grabOffsetSeconds))
    : visibleDuration / 2;
  const maximumStart = duration - visibleDuration;
  const start = Math.min(maximumStart, Math.max(0, duration * safeRatio - safeGrabOffset));
  return start + visibleDuration / 2;
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
