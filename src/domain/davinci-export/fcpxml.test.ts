import { describe, expect, it } from 'vitest';

import { createProjectClip, reorderProjectClips, updateProjectClip } from '../clips';
import { createProject, portableProjectSchema } from '../projects';
import { createDaVinciTimeline } from './fcpxml';

describe('createDaVinciTimeline', () => {
  it('exports ordered gapless clips with source video and audio references', () => {
    const firstVodId = '11111111-1111-4111-8111-111111111111';
    const secondVodId = '22222222-2222-4222-8222-222222222222';
    const base = portableProjectSchema.parse({
      ...createProject('Siege & Finals'),
      vods: [
        vod(firstVodId, 'Perspective A & Lead.mp4', 120),
        vod(secondVodId, 'Perspective B.mp4', 90),
      ],
    });
    const first = createProjectClip(base, firstVodId, {
      inPointSeconds: 10,
      outPointSeconds: 20,
      matchingEventIds: [],
    });
    const firstId = first.clipOrder[0]!;
    const second = createProjectClip(first, secondVodId, {
      inPointSeconds: 30,
      outPointSeconds: 35,
      matchingEventIds: [],
    });
    const secondId = second.clipOrder[1]!;
    const named = updateProjectClip(
      updateProjectClip(second, firstId, { title: 'First & angle' }),
      secondId,
      { title: 'Second angle' },
    );
    const reordered = reorderProjectClips(named, [secondId, firstId]);

    const result = createDaVinciTimeline(reordered, {
      frameRate: 60,
      width: 2560,
      height: 1440,
    });

    expect(result.fileName).toBe('Siege & Finals.fcpxml');
    expect(result.timelineDurationFrames).toBe(900);
    expect(result.content).toContain('frameDuration="1/60s" width="2560" height="1440"');
    expect(result.content).toContain('name="Perspective A &amp; Lead.mp4"');
    expect(result.content).toContain('src="file://localhost/Perspective%20A%20%26%20Lead.mp4"');
    expect(result.content).toContain('hasVideo="1" hasAudio="1"');
    expect(
      new DOMParser()
        .parseFromString(result.content, 'application/xml')
        .querySelector('parsererror'),
    ).toBeNull();
    expect(result.content.indexOf('name="Second angle"')).toBeLessThan(
      result.content.indexOf('name="First &amp; angle"'),
    );
    expect(result.content).toContain(
      'name="Second angle" ref="r2" offset="0s" start="30s" duration="5s"',
    );
    expect(result.content).toContain(
      'name="First &amp; angle" ref="r3" offset="5s" start="10s" duration="10s"',
    );
  });

  it('uses the exact NTSC frame-duration fraction', () => {
    const project = portableProjectSchema.parse({
      ...createProject('NTSC'),
      vods: [vod('33333333-3333-4333-8333-333333333333', 'NTSC.mp4', 10)],
    });
    const withClip = createProjectClip(project, project.vods[0]!.id, {
      inPointSeconds: 0,
      outPointSeconds: 1,
      matchingEventIds: [],
    });

    expect(
      createDaVinciTimeline(withClip, { frameRate: 59.94, width: 1920, height: 1080 }).content,
    ).toContain('frameDuration="1001/60000s"');
  });
});

function vod(id: string, fileName: string, durationSeconds: number) {
  return {
    id,
    displayName: fileName.replace(/\.mp4$/i, ''),
    fileName,
    fileSizeBytes: 12,
    lastModifiedMs: 100,
    durationSeconds,
    width: 2560,
    height: 1440,
    nominalFrameRate: 60,
    variableFrameRate: false,
    videoCodec: null,
    audioCodec: null,
    synchronizationAnchor: null,
    searchTerms: [],
    splitSearchTerms: [],
  };
}
