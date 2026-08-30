import { describe, expect, it } from 'vitest';

import { createProject, portableProjectSchema } from '../projects';
import {
  mapSessionTimeToVideoTime,
  mapVideoTimeToSessionTime,
  synchronizeVod,
} from './synchronization';

describe('VOD synchronization', () => {
  it('stores an independent anchor and calculated offset without mutating the project', () => {
    const project = portableProjectSchema.parse({
      ...createProject('Node War'),
      vods: [createVodReference('11111111-1111-4111-8111-111111111111')],
    });

    const synchronized = synchronizeVod(
      project,
      project.vods[0]!.id,
      {
        eventId: '2026-08-29:1',
        eventSessionTimeSeconds: 72_056,
        videoTimeSeconds: 55.25,
      },
      new Date('2026-08-30T16:00:00.000Z'),
    );

    expect(project.vods[0]!.synchronizationAnchor).toBeNull();
    expect(synchronized.vods[0]!.synchronizationAnchor).toEqual({
      eventId: '2026-08-29:1',
      eventSessionTimeSeconds: 72_056,
      videoTimeSeconds: 55.25,
      offsetSeconds: -72_000.75,
    });
  });

  it('maps every log event through the selected anchor', () => {
    const anchor = {
      eventId: '2026-08-29:1',
      eventSessionTimeSeconds: 72_056,
      videoTimeSeconds: 55.25,
    };

    expect(mapSessionTimeToVideoTime(anchor, 72_056)).toBe(55.25);
    expect(mapSessionTimeToVideoTime(anchor, 72_061.5)).toBe(60.75);
    expect(mapVideoTimeToSessionTime(anchor, 60.75)).toBe(72_061.5);
  });
});

function createVodReference(id: string) {
  return {
    id,
    displayName: 'Perspective',
    fileName: 'Perspective.mp4',
    fileSizeBytes: 100,
    lastModifiedMs: 100,
    durationSeconds: 100,
    width: 1920,
    height: 1080,
    nominalFrameRate: 60,
    variableFrameRate: false,
    videoCodec: null,
    audioCodec: null,
    synchronizationAnchor: null,
    searchTerms: [],
  };
}
