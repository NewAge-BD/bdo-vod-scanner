import { describe, expect, it } from 'vitest';

import {
  calculatePointerAnchoredZoomCenter,
  calculateTimelineNavigatorCenter,
  calculateTimelineWindow,
  zoomLevelToFactor,
} from './videoTimeline';

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

  it('keeps the time below an off-center pointer stationary while zooming', () => {
    const currentWindow = calculateTimelineWindow(600, 300, 2);
    const nextCenter = calculatePointerAnchoredZoomCenter(600, currentWindow, 4, 0.75);
    const nextWindow = calculateTimelineWindow(600, nextCenter, 4);

    const timeBefore = currentWindow.startSeconds + currentWindow.durationSeconds * 0.75;
    const timeAfter = nextWindow.startSeconds + nextWindow.durationSeconds * 0.75;
    expect(timeAfter).toBeCloseTo(timeBefore, 10);
    expect(nextWindow.startSeconds).toBe(262.5);
  });

  it('moves a visible window from the full-video navigator while preserving its grab point', () => {
    expect(calculateTimelineNavigatorCenter(600, 120, 0.75, 30)).toBe(480);
    expect(calculateTimelineNavigatorCenter(600, 120, 0, 30)).toBe(60);
    expect(calculateTimelineNavigatorCenter(600, 120, 1, 30)).toBe(540);
  });
});
