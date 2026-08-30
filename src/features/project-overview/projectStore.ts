import { createStore } from 'zustand/vanilla';

import {
  createProject,
  parseProjectFile,
  renameProject,
  type PortableProject,
} from '../../domain/projects';
import type { ProjectRepository } from '../../infrastructure/projects';

export type ProjectStoreStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ProjectStoreState {
  readonly projects: readonly PortableProject[];
  readonly activeProjectId: string | undefined;
  readonly status: ProjectStoreStatus;
  readonly errorMessage: string | undefined;
  readonly load: () => Promise<void>;
  readonly create: (name: string) => Promise<void>;
  readonly importProject: (content: string) => Promise<void>;
  readonly rename: (id: string, name: string) => Promise<void>;
  readonly delete: (id: string) => Promise<void>;
  readonly open: (id: string) => void;
  readonly close: () => void;
  readonly dismissError: () => void;
}

export function createProjectStore(repository: ProjectRepository) {
  return createStore<ProjectStoreState>()((set, get) => ({
    projects: [],
    activeProjectId: undefined,
    status: 'idle',
    errorMessage: undefined,

    load: async () => {
      set({ status: 'loading', errorMessage: undefined });
      try {
        set({ projects: await repository.list(), status: 'ready' });
      } catch {
        set({ status: 'error', errorMessage: 'projects.errors.storage' });
      }
    },

    create: async (name) => {
      try {
        const project = createProject(name);
        await repository.save(project);
        set({
          projects: sortProjects([project, ...get().projects]),
          activeProjectId: project.id,
          status: 'ready',
          errorMessage: undefined,
        });
      } catch {
        set({ errorMessage: 'projects.errors.create' });
      }
    },

    importProject: async (content) => {
      try {
        const project = parseProjectFile(content);
        if ((await repository.get(project.id)) !== undefined) {
          set({ errorMessage: 'projects.errors.duplicate' });
          return;
        }

        await repository.save(project);
        set({
          projects: sortProjects([project, ...get().projects]),
          activeProjectId: project.id,
          status: 'ready',
          errorMessage: undefined,
        });
      } catch (error: unknown) {
        const code = readImportErrorCode(error);
        set({ errorMessage: `projects.errors.${code}` });
      }
    },

    rename: async (id, name) => {
      const project = get().projects.find((candidate) => candidate.id === id);
      if (project === undefined) {
        set({ errorMessage: 'projects.errors.missing' });
        return;
      }

      try {
        const updatedProject = renameProject(project, name);
        await repository.save(updatedProject);
        set({
          projects: sortProjects(
            get().projects.map((candidate) => (candidate.id === id ? updatedProject : candidate)),
          ),
          errorMessage: undefined,
        });
      } catch {
        set({ errorMessage: 'projects.errors.rename' });
      }
    },

    delete: async (id) => {
      try {
        await repository.delete(id);
        set({
          projects: get().projects.filter((project) => project.id !== id),
          activeProjectId: get().activeProjectId === id ? undefined : get().activeProjectId,
          errorMessage: undefined,
        });
      } catch {
        set({ errorMessage: 'projects.errors.delete' });
      }
    },

    open: (id) => set({ activeProjectId: id }),
    close: () => set({ activeProjectId: undefined }),
    dismissError: () => set({ errorMessage: undefined }),
  }));
}

function sortProjects(projects: readonly PortableProject[]): readonly PortableProject[] {
  return [...projects].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function readImportErrorCode(error: unknown): 'invalidJson' | 'invalidProject' | 'newerVersion' {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'invalidJson' ||
      error.code === 'invalidProject' ||
      error.code === 'newerVersion')
  ) {
    return error.code;
  }

  return 'invalidProject';
}
