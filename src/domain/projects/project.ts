import { APP_VERSION, CURRENT_PROJECT_SCHEMA_VERSION, PROJECT_FILE_SUFFIX } from './constants';
import { portableProjectSchema, type PortableProject } from './schema';

export function createProject(name: string, now = new Date()): PortableProject {
  const timestamp = now.toISOString();

  return portableProjectSchema.parse({
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    id: crypto.randomUUID(),
    name,
    sessionDate: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    rawLog: null,
    parserVersion: 1,
    vods: [],
    clips: [],
    clipOrder: [],
    uiState: {
      clipPanelCollapsed: false,
    },
    davinciDefaults: {
      frameRate: 60,
      width: 1920,
      height: 1080,
    },
  });
}

export function renameProject(
  project: PortableProject,
  name: string,
  now = new Date(),
): PortableProject {
  return portableProjectSchema.parse({
    ...project,
    name,
    updatedAt: now.toISOString(),
  });
}

export function getProjectExportFileName(project: PortableProject): string {
  const nameWithoutReservedCharacters = project.name
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*]/g, '-')
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 ? '-' : character))
    .join('');
  const safeName = nameWithoutReservedCharacters
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');

  return `${safeName.length > 0 ? safeName : 'project'}${PROJECT_FILE_SUFFIX}`;
}
