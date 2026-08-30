import { describe, expect, it } from 'vitest';

import { calculateTimelineWindow, zoomLevelToFactor } from './videoTimeline';

describe('video timeline window', () => {
  it('shows the complete media at the minimum zoom', () => {
    expect(calculateTimelineWindow(6_600, 120, 1)).toEqual({
      startSeconds: 0,
      endSeconds: 6_600,
      durationSeconds: 6_600,
    });
  });

  it('centers a zoomed window on the playhead', () => {
    expect(calculateTimelineWindow(600, 300, 10)).toEqual({
      startSeconds: 270,
      endSeconds: 330,
      durationSeconds: 60,
    });
  });

  it('keeps zoomed windows inside the media boundaries', () => {
    expect(calculateTimelineWindow(600, 5, 10)).toEqual({
      startSeconds: 0,
      endSeconds: 60,
      durationSeconds: 60,
    });
    expect(calculateTimelineWindow(600, 595, 10)).toEqual({
      startSeconds: 540,
      endSeconds: 600,
      durationSeconds: 60,
    });
  });

  it('uses an exponential zoom scale with safe bounds', () => {
    expect(zoomLevelToFactor(1)).toBe(1);
    expect(zoomLevelToFactor(13)).toBe(2);
    expect(zoomLevelToFactor(0)).toBe(1);
    expect(zoomLevelToFactor(999)).toBeCloseTo(966.5, 1);
  });
});
