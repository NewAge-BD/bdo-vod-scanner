import { describe, expect, it } from 'vitest';

import { createProject, getProjectExportFileName, renameProject } from './project';
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
