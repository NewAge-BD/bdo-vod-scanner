export interface ViewportPoint {
  readonly x: number;
  readonly y: number;
}

export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

export function clampVideoPan(
  pan: ViewportPoint,
  viewport: ViewportSize,
  zoom: number,
): ViewportPoint {
  const safeZoom = finiteAtLeastOne(zoom);
  const maximumX = (finiteNonNegative(viewport.width) * (safeZoom - 1)) / 2;
  const maximumY = (finiteNonNegative(viewport.height) * (safeZoom - 1)) / 2;

  return {
    x: clamp(finiteOrZero(pan.x), -maximumX, maximumX),
    y: clamp(finiteOrZero(pan.y), -maximumY, maximumY),
  };
}

export function zoomVideoAtPoint({
  currentZoom,
  nextZoom,
  currentPan,
  pointer,
  viewport,
}: {
  readonly currentZoom: number;
  readonly nextZoom: number;
  readonly currentPan: ViewportPoint;
  readonly pointer: ViewportPoint;
  readonly viewport: ViewportSize;
}): ViewportPoint {
  const safeCurrentZoom = finiteAtLeastOne(currentZoom);
  const safeNextZoom = finiteAtLeastOne(nextZoom);
  const pointerFromCenter = {
    x: finiteOrZero(pointer.x) - finiteNonNegative(viewport.width) / 2,
    y: finiteOrZero(pointer.y) - finiteNonNegative(viewport.height) / 2,
  };
  const contentPoint = {
    x: (pointerFromCenter.x - finiteOrZero(currentPan.x)) / safeCurrentZoom,
    y: (pointerFromCenter.y - finiteOrZero(currentPan.y)) / safeCurrentZoom,
  };

  return clampVideoPan(
    {
      x: pointerFromCenter.x - contentPoint.x * safeNextZoom,
      y: pointerFromCenter.y - contentPoint.y * safeNextZoom,
    },
    viewport,
    safeNextZoom,
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (maximum === 0) {
    return 0;
  }
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteAtLeastOne(value: number): number {
  return Number.isFinite(value) ? Math.max(1, value) : 1;
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
