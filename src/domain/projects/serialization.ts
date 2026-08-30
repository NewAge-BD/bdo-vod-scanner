import { CURRENT_PROJECT_SCHEMA_VERSION } from './constants';
import { portableProjectSchema, type PortableProject } from './schema';

export class ProjectImportError extends Error {
  constructor(
    readonly code: 'invalidJson' | 'invalidProject' | 'newerVersion',
    message: string,
  ) {
    super(message);
    this.name = 'ProjectImportError';
  }
}

export function serializeProject(project: PortableProject): string {
  const validatedProject = portableProjectSchema.parse(project);
  return `${JSON.stringify(validatedProject, null, 2)}\n`;
}

export function parseProjectFile(content: string): PortableProject {
  let input: unknown;

  try {
    input = JSON.parse(content) as unknown;
  } catch {
    throw new ProjectImportError('invalidJson', 'The selected file is not valid JSON.');
  }

  const schemaVersion = readSchemaVersion(input);
  if (schemaVersion !== undefined && schemaVersion > CURRENT_PROJECT_SCHEMA_VERSION) {
    throw new ProjectImportError(
      'newerVersion',
      'This project was created by a newer BDO VOD Scanner version. Update the app first.',
    );
  }

  const result = portableProjectSchema.safeParse(input);
  if (!result.success) {
    throw new ProjectImportError('invalidProject', 'The selected file is not a valid project.');
  }

  return result.data;
}

function readSchemaVersion(input: unknown): number | undefined {
  if (typeof input !== 'object' || input === null || !('schemaVersion' in input)) {
    return undefined;
  }

  const value = input.schemaVersion;
  return typeof value === 'number' ? value : undefined;
}
