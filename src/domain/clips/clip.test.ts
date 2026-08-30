import { describe, expect, it } from 'vitest';

import { createProject, portableProjectSchema } from '../projects';
import {
  createProjectClip,
  deleteProjectClip,
  setClipPanelCollapsed,
  updateProjectClip,
} from './clip';

describe('clip domain', () => {
  it('creates, edits, and deletes a clip without changing its search snapshot', () => {
    const project = projectWithVod();
    const vodId = project.vods[0]!.id;
    const created = createProjectClip(
      project,
      vodId,
      { inPointSeconds: 10, outPointSeconds: 20, matchingEventIds: ['event-1'] },
      new Date('2026-08-30T12:00:00.000Z'),
    );
    const clip = created.clips[0]!;

    expect(project.clips).toEqual([]);
    expect(clip).toEqual(
      expect.objectContaining({
        vodId,
        title: 'CopperGrove',
        inPointSeconds: 10,
        outPointSeconds: 20,
        searchTermsSnapshot: ['CopperGrove'],
        matchingEventIds: ['event-1'],
        order: 0,
      }),
    );
    expect(created.clipOrder).toEqual([clip.id]);

    const updated = updateProjectClip(
      created,
      clip.id,
      { title: 'Opening pick', outPointSeconds: 22 },
      new Date('2026-08-30T12:01:00.000Z'),
    );
    expect(updated.clips[0]).toEqual(
      expect.objectContaining({
        title: 'Opening pick',
        inPointSeconds: 10,
        outPointSeconds: 22,
        searchTermsSnapshot: ['CopperGrove'],
        matchingEventIds: ['event-1'],
      }),
    );

    const collapsed = setClipPanelCollapsed(updated, true);
    expect(collapsed.uiState.clipPanelCollapsed).toBe(true);

    const deleted = deleteProjectClip(collapsed, clip.id);
    expect(deleted.clips).toEqual([]);
    expect(deleted.clipOrder).toEqual([]);
  });

  it('rejects empty and out-of-range clip ranges', () => {
    const project = projectWithVod();
    const vodId = project.vods[0]!.id;

    expect(() =>
      createProjectClip(project, vodId, {
        inPointSeconds: 10,
        outPointSeconds: 10,
        matchingEventIds: [],
      }),
    ).toThrow('outside the source VOD');
    expect(() =>
      createProjectClip(project, vodId, {
        inPointSeconds: 50,
        outPointSeconds: 61,
        matchingEventIds: [],
      }),
    ).toThrow('outside the source VOD');
  });
});

function projectWithVod() {
  const project = createProject('Clip test');
  return portableProjectSchema.parse({
    ...project,
    vods: [
      {
        id: crypto.randomUUID(),
        displayName: 'Perspective',
        fileName: 'Perspective.mp4',
        fileSizeBytes: 12,
        lastModifiedMs: 100,
        durationSeconds: 60,
        width: 1920,
        height: 1080,
        nominalFrameRate: 60,
        variableFrameRate: false,
        videoCodec: null,
        audioCodec: null,
        synchronizationAnchor: null,
        searchTerms: ['CopperGrove'],
      },
    ],
  });
}
