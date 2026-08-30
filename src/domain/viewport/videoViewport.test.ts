import { describe, expect, it } from 'vitest';

import { clampVideoPan, zoomVideoAtPoint } from './videoViewport';

describe('video viewport', () => {
  it('centers the image when it is not zoomed', () => {
    expect(clampVideoPan({ x: 100, y: -100 }, { width: 800, height: 450 }, 1)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('keeps a zoomed image inside its visible pan bounds', () => {
    expect(clampVideoPan({ x: 900, y: -900 }, { width: 800, height: 450 }, 2)).toEqual({
      x: 400,
      y: -225,
    });
  });

  it('keeps the image point beneath the pointer while zooming', () => {
    expect(
      zoomVideoAtPoint({
        currentZoom: 1,
        nextZoom: 2,
        currentPan: { x: 0, y: 0 },
        pointer: { x: 600, y: 225 },
        viewport: { width: 800, height: 450 },
      }),
    ).toEqual({ x: -200, y: 0 });
  });
});
