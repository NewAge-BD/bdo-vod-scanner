import { describe, expect, it } from 'vitest';

import { createProject } from '../../domain/projects';
import type { InspectedVideoMetadata, VideoMetadataInspector } from '../../infrastructure/media';
import syntheticLog from '../../test/fixtures/2026-08-29.log?raw';
import { importSourceFiles } from './importSourceFiles';
import { SourceImportError } from './types';

const metadata: InspectedVideoMetadata = {
  durationSeconds: 3_600.5,
  width: 2560,
  height: 1440,
  nominalFrameRate: null,
  variableFrameRate: null,
  videoCodec: null,
  audioCodec: null,
};

const metadataInspector: VideoMetadataInspector = {
  inspect: () => Promise.resolve(metadata),
};

describe('source import', () => {
  it('imports one parsed log and multiple validated MP4 references without storing media bytes', async () => {
    const project = createProject('Node War');
    const log = new File([syntheticLog], '2026-08-29.log', { type: 'text/plain' });
    const firstVod = createMp4File('Perspective One.mp4', 100);
    const secondVod = createMp4File('Perspective Two.mp4', 200);

    const result = await importSourceFiles(
      project,
      [log, firstVod, secondVod],
      metadataInspector,
      new Date('2026-08-30T15:00:00.000Z'),
    );

    expect(result.importedLog).toBe(true);
    expect(result.eventCount).toBe(3);
    expect(result.project.rawLog).toBe(syntheticLog);
    expect(result.project.sessionDate).toBe('2026-08-29');
    expect(result.project.vods).toHaveLength(2);
    expect(result.project.vods[0]).toEqual(
      expect.objectContaining({
        fileName: 'Perspective One.mp4',
        durationSeconds: 3_600.5,
        width: 2560,
        height: 1440,
      }),
    );
    expect(result.project.davinciDefaults).toEqual({ frameRate: 60, width: 2560, height: 1440 });
    expect(result.vodFiles.size).toBe(2);
    expect(result.relinkedVodCount).toBe(0);
    expect(JSON.stringify(result.project)).not.toContain('ftyp');
  });

  it('keeps a signed MP4 when browser metadata decoding is unavailable', async () => {
    const result = await importSourceFiles(createProject('Node War'), [createMp4File('AV1.mp4')], {
      inspect: () => Promise.reject(new Error('unsupported codec')),
    });

    expect(result.project.vods).toHaveLength(1);
    expect(result.project.vods[0]?.durationSeconds).toBeNull();
    expect(result.issues).toEqual([{ code: 'metadataUnavailable', fileName: 'AV1.mp4' }]);
  });

  it('imports a validated Ikusa JSON event source', async () => {
    const rawLog = JSON.stringify({
      format: 'ikusa-raw-session',
      version: 4,
      saved_at: '2026-08-29T19:49:37.920Z',
      logs: [
        {
          time: '20:01:39',
          isKill: true,
          names: ['ShadeLance', 'MoonGuard', 'SolarBloom', 'EmberVale', 'NightHarbor'],
        },
      ],
    });
    const result = await importSourceFiles(
      createProject('Siege'),
      [new File([rawLog], 'siege_2026-08-29.ikusa.json', { type: 'application/json' })],
      metadataInspector,
    );

    expect(result.importedLog).toBe(true);
    expect(result.eventCount).toBe(1);
    expect(result.project.sessionDate).toBe('2026-08-29');
    expect(result.project.rawLog).toBe(rawLog);
    expect(result.project.parserVersion).toBe(2);
  });

  it('rejects fake MP4 content while reporting unrelated unsupported files', async () => {
    const fakeVideo = new File(['not a video'], 'Fake.mp4', { type: 'video/mp4' });
    const note = new File(['note'], 'readme.txt', { type: 'text/plain' });

    await expectImportError(
      () => importSourceFiles(createProject('Node War'), [fakeVideo, note], metadataInspector),
      'noUsableFiles',
    );
  });

  it('does not silently replace an existing log or accept multiple logs', async () => {
    const log = new File([syntheticLog], '2026-08-29.log');
    const imported = await importSourceFiles(createProject('Node War'), [log], metadataInspector);

    await expectImportError(
      () => importSourceFiles(imported.project, [log], metadataInspector),
      'existingLog',
    );
    await expectImportError(
      () =>
        importSourceFiles(
          createProject('Node War'),
          [log, new File([syntheticLog], '2026-08-30.log')],
          metadataInspector,
        ),
      'multipleLogs',
    );
  });

  it('relinks a matching persisted VOD without adding another reference', async () => {
    const file = createMp4File('Perspective.mp4');
    const imported = await importSourceFiles(createProject('Node War'), [file], metadataInspector);
    const relinked = await importSourceFiles(imported.project, [file], metadataInspector);

    expect(relinked.project.vods).toHaveLength(1);
    expect(relinked.importedVodCount).toBe(0);
    expect(relinked.relinkedVodCount).toBe(1);
    expect(relinked.vodFiles.get(imported.project.vods[0]!.id)).toBe(file);
    expect(relinked.issues).toEqual([{ code: 'relinkedVod', fileName: 'Perspective.mp4' }]);
  });

  it('fills missing container metadata when an existing VOD is relinked', async () => {
    const file = createMp4File('Perspective.mp4');
    const imported = await importSourceFiles(createProject('Node War'), [file], metadataInspector);
    const refreshedMetadata: InspectedVideoMetadata = {
      ...metadata,
      nominalFrameRate: 59.94,
      variableFrameRate: false,
      videoCodec: 'avc',
      audioCodec: 'aac',
    };
    const refreshedAt = new Date('2026-09-01T10:00:00.000Z');

    const relinked = await importSourceFiles(
      imported.project,
      [file],
      { inspect: () => Promise.resolve(refreshedMetadata) },
      refreshedAt,
    );

    expect(relinked.project.vods[0]).toEqual(
      expect.objectContaining({
        nominalFrameRate: 59.94,
        variableFrameRate: false,
        videoCodec: 'avc',
        audioCodec: 'aac',
      }),
    );
    expect(relinked.project.updatedAt).toBe(refreshedAt.toISOString());
  });
});

function createMp4File(name: string, lastModified = 100): File {
  return new File([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109])], name, {
    type: 'video/mp4',
    lastModified,
  });
}

async function expectImportError(action: () => Promise<unknown>, code: SourceImportError['code']) {
  try {
    await action();
    throw new Error('Expected source import to fail.');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(SourceImportError);
    expect((error as SourceImportError).code).toBe(code);
  }
}
