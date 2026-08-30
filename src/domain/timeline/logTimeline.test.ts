import { describe, expect, it } from 'vitest';

import { buildLogTimelineMarkers, type TimelineLogEvent } from './logTimeline';

const events: readonly TimelineLogEvent[] = [
  { id: 'kill', sessionTimeSeconds: 10, verb: 'killed' },
  { id: 'death', sessionTimeSeconds: 20, verb: 'diedTo' },
  { id: 'later', sessionTimeSeconds: 200, verb: 'killed' },
];

describe('log timeline markers', () => {
  it('maps visible kills and deaths onto the video window', () => {
    const markers = buildLogTimelineMarkers(
      events,
      (sessionTime) => sessionTime + 5,
      { startSeconds: 0, endSeconds: 100, durationSeconds: 100 },
      100,
    );

    expect(markers).toHaveLength(2);
    expect(markers[0]).toMatchObject({ eventIds: ['kill'], positionRatio: 0.15, type: 'kill' });
    expect(markers[1]).toMatchObject({ eventIds: ['death'], positionRatio: 0.25, type: 'death' });
  });

  it('bundles dense events into a neutral marker', () => {
    const markers = buildLogTimelineMarkers(
      events.slice(0, 2),
      (sessionTime) => sessionTime,
      { startSeconds: 0, endSeconds: 100, durationSeconds: 100 },
      1,
    );

    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({
      eventCount: 2,
      eventIds: ['kill', 'death'],
      killCount: 1,
      killStreakTier: null,
      type: 'bundle',
    });
  });

  it.each([
    [2, 'challenger'],
    [3, 'invader'],
    [4, 'slayer'],
    [5, 'conqueror'],
    [6, 'conqueror'],
  ] as const)('maps %s kills within fifteen seconds to %s', (killCount, expectedTier) => {
    const killStreakEvents = Array.from({ length: killCount }, (_, index) => ({
      id: `kill-${index}`,
      sessionTimeSeconds: 30 + index,
      verb: 'killed' as const,
    }));
    const markers = buildLogTimelineMarkers(
      killStreakEvents,
      (sessionTime) => sessionTime,
      { startSeconds: 0, endSeconds: 100, durationSeconds: 100 },
      1,
      true,
    );

    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({
      eventCount: killCount,
      killCount,
      killStreakCount: killCount,
      killStreakTier: expectedTier,
      representativeEventId: `kill-${killCount - 1}`,
      type: 'bundle',
      videoTimeSeconds: 30 + killCount - 1,
    });
  });

  it('does not combine kills that are more than fifteen seconds apart', () => {
    const markers = buildLogTimelineMarkers(
      [
        { id: 'first', sessionTimeSeconds: 10, verb: 'killed' },
        { id: 'second', sessionTimeSeconds: 26, verb: 'killed' },
      ],
      (sessionTime) => sessionTime,
      { startSeconds: 0, endSeconds: 100, durationSeconds: 100 },
      1,
      true,
    );

    expect(markers[0]).toMatchObject({ killStreakCount: 1, killStreakTier: null });
  });

  it('does not annotate ordinary event timelines with kill streaks', () => {
    const markers = buildLogTimelineMarkers(
      [
        { id: 'first', sessionTimeSeconds: 10, verb: 'killed' },
        { id: 'second', sessionTimeSeconds: 12, verb: 'killed' },
      ],
      (sessionTime) => sessionTime,
      { startSeconds: 0, endSeconds: 100, durationSeconds: 100 },
      1,
    );

    expect(markers[0]).toMatchObject({ killStreakCount: 0, killStreakTier: null });
  });

  it('returns no markers for an invalid visible range', () => {
    expect(
      buildLogTimelineMarkers(events, (sessionTime) => sessionTime, {
        startSeconds: 0,
        endSeconds: 0,
        durationSeconds: 0,
      }),
    ).toEqual([]);
  });
});
