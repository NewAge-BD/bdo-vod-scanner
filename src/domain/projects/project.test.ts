import { describe, expect, it } from 'vitest';

import {
  createProject,
  deleteProjectVod,
  getProjectExportFileName,
  renameProject,
  setVodSearchTerms,
  setVodSplitSearchTerms,
} from './project';
import { portableProjectSchema } from './schema';
import { parseProjectFile, ProjectImportError, serializeProject } from './serialization';

describe('project domain', () => {
  it('creates a valid empty local project with approved defaults', () => {
    const project = createProject('Node War review', new Date('2026-08-30T12:00:00.000Z'));

    expect(portableProjectSchema.parse(project)).toEqual(project);
    expect(project).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        appVersion: '0.0.0',
        name: 'Node War review',
        sessionDate: null,
        rawLog: null,
        vods: [],
        clips: [],
        davinciDefaults: { frameRate: 60, width: 1920, height: 1080 },
      }),
    );
  });

  it('renames a project and updates its timestamp without mutating the original', () => {
    const project = createProject('Draft', new Date('2026-08-30T12:00:00.000Z'));
    const renamed = renameProject(project, 'Siege review', new Date('2026-08-30T13:00:00.000Z'));

    expect(project.name).toBe('Draft');
    expect(renamed.name).toBe('Siege review');
    expect(renamed.updatedAt).toBe('2026-08-30T13:00:00.000Z');
  });

  it('stores normalized independent search terms on one VOD', () => {
    const project = createProject('Searches', new Date('2026-08-30T12:00:00.000Z'));
    const vodId = crypto.randomUUID();
    const projectWithVod = portableProjectSchema.parse({
      ...project,
      vods: [
        {
          id: vodId,
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
          searchTerms: [],
        },
      ],
    });

    const updated = setVodSearchTerms(
      projectWithVod,
      vodId,
      [' EmberVale ', 'rivERwarden', 'embervale'],
      new Date('2026-08-30T13:00:00.000Z'),
    );

    expect(projectWithVod.vods[0]?.searchTerms).toEqual([]);
    expect(projectWithVod.vods[0]?.splitSearchTerms).toEqual([]);
    expect(updated.vods[0]?.searchTerms).toEqual(['EmberVale', 'rivERwarden']);
    expect(updated.updatedAt).toBe('2026-08-30T13:00:00.000Z');
  });

  it('stores split name timelines per VOD and prunes removed names', () => {
    const project = createProject('Timeline layout', new Date('2026-08-30T12:00:00.000Z'));
    const vodId = crypto.randomUUID();
    const projectWithVod = portableProjectSchema.parse({
      ...project,
      vods: [
        {
          id: vodId,
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
          searchTerms: ['NewAge', 'RiverWarden'],
        },
      ],
    });

    const split = setVodSplitSearchTerms(
      projectWithVod,
      vodId,
      [' NewAge ', 'newage', 'Unknown'],
      new Date('2026-08-30T13:00:00.000Z'),
    );
    expect(split.vods[0]?.splitSearchTerms).toEqual(['NewAge']);

    const removed = setVodSearchTerms(
      split,
      vodId,
      ['RiverWarden'],
      new Date('2026-08-30T14:00:00.000Z'),
    );
    expect(removed.vods[0]?.splitSearchTerms).toEqual([]);
  });

  it('deletes one VOD and only the clips owned by that perspective', () => {
    const project = createProject('Delete perspective', new Date('2026-08-30T12:00:00.000Z'));
    const removedVodId = '11111111-1111-4111-8111-111111111111';
    const retainedVodId = '22222222-2222-4222-8222-222222222222';
    const removedClipId = '33333333-3333-4333-8333-333333333333';
    const retainedClipId = '44444444-4444-4444-8444-444444444444';
    const vod = (id: string, name: string) => ({
      id,
      displayName: name,
      fileName: `${name}.mp4`,
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
      searchTerms: [],
    });
    const clip = (id: string, vodId: string, order: number) => ({
      id,
      vodId,
      title: `Clip ${order}`,
      inPointSeconds: 1,
      outPointSeconds: 2,
      searchTermsSnapshot: [],
      matchingEventIds: [],
      order,
      createdAt: '2026-08-30T12:00:00.000Z',
      exportStatus: 'notExported' as const,
      lastErrorCode: null,
    });
    const populated = portableProjectSchema.parse({
      ...project,
      vods: [vod(removedVodId, 'Removed'), vod(retainedVodId, 'Retained')],
      clips: [clip(removedClipId, removedVodId, 0), clip(retainedClipId, retainedVodId, 1)],
      clipOrder: [removedClipId, retainedClipId],
    });

    const updated = deleteProjectVod(populated, removedVodId, new Date('2026-08-30T13:00:00.000Z'));

    expect(updated.vods.map((candidate) => candidate.id)).toEqual([retainedVodId]);
    expect(updated.clips.map((candidate) => candidate.id)).toEqual([retainedClipId]);
    expect(updated.clipOrder).toEqual([retainedClipId]);
    expect(updated.updatedAt).toBe('2026-08-30T13:00:00.000Z');
    expect(populated.vods).toHaveLength(2);
  });

  it('round-trips a portable project', () => {
    const project = createProject('Node War review');
    expect(parseProjectFile(serializeProject(project))).toEqual(project);
  });

  it('rejects invalid JSON and malformed projects', () => {
    expectImportError(() => parseProjectFile('{'), 'invalidJson');
    expectImportError(() => parseProjectFile('{"schemaVersion":1}'), 'invalidProject');
  });

  it('rejects unknown newer project versions with a dedicated error', () => {
    expectImportError(() => parseProjectFile('{"schemaVersion":2}'), 'newerVersion');
  });

  it('creates a sanitized, recognizable export filename', () => {
    const project = createProject('  Siege: EU / Finals.  ');
    expect(getProjectExportFileName(project)).toBe('Siege- EU - Finals.bdo-vod-project.json');
  });

  it('rejects empty names and unknown project fields', () => {
    expect(() => createProject('   ')).toThrow();

    const project = createProject('Valid');
    expect(() => portableProjectSchema.parse({ ...project, unexpected: true })).toThrow();
  });
});

function expectImportError(action: () => unknown, code: ProjectImportError['code']) {
  try {
    action();
    throw new Error('Expected project import to fail.');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ProjectImportError);
    expect((error as ProjectImportError).code).toBe(code);
  }
}
