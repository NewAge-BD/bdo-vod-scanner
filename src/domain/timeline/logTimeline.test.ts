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
      type: 'bundle',
    });
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
