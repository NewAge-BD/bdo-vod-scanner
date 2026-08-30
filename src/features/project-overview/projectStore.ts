import { createStore } from 'zustand/vanilla';

import {
  createProject,
  parseProjectFile,
  renameProject,
  type PortableProject,
} from '../../domain/projects';
import { synchronizeVod, type SynchronizationAnchorInput } from '../../domain/synchronization';
import type { ProjectRepository } from '../../infrastructure/projects';

export type ProjectStoreStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ProjectStoreState {
  readonly projects: readonly PortableProject[];
  readonly activeProjectId: string | undefined;
  readonly status: ProjectStoreStatus;
  readonly errorMessage: string | undefined;
  readonly vodFiles: ReadonlyMap<string, File>;
  readonly load: () => Promise<void>;
  readonly create: (name: string) => Promise<void>;
  readonly importProject: (content: string) => Promise<void>;
  readonly rename: (id: string, name: string) => Promise<void>;
  readonly delete: (id: string) => Promise<void>;
  readonly open: (id: string) => void;
  readonly close: () => void;
  readonly dismissError: () => void;
  readonly saveSourceImport: (
    project: PortableProject,
    vodFiles: ReadonlyMap<string, File>,
  ) => Promise<boolean>;
  readonly saveSynchronization: (
    projectId: string,
    vodId: string,
    anchor: SynchronizationAnchorInput,
  ) => Promise<boolean>;
}

export function createProjectStore(repository: ProjectRepository) {
  return createStore<ProjectStoreState>()((set, get) => ({
    projects: [],
    activeProjectId: undefined,
    status: 'idle',
    errorMessage: undefined,
    vodFiles: new Map(),

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
        const deletedProject = get().projects.find((project) => project.id === id);
        await repository.delete(id);
        const remainingVodFiles = new Map(get().vodFiles);
        for (const vod of deletedProject?.vods ?? []) {
          remainingVodFiles.delete(vod.id);
        }
        set({
          projects: get().projects.filter((project) => project.id !== id),
          activeProjectId: get().activeProjectId === id ? undefined : get().activeProjectId,
          vodFiles: remainingVodFiles,
          errorMessage: undefined,
        });
      } catch {
        set({ errorMessage: 'projects.errors.delete' });
      }
    },

    open: (id) => set({ activeProjectId: id }),
    close: () => set({ activeProjectId: undefined }),
    dismissError: () => set({ errorMessage: undefined }),

    saveSourceImport: async (project, vodFiles) => {
      if (!get().projects.some((candidate) => candidate.id === project.id)) {
        set({ errorMessage: 'projects.errors.missing' });
        return false;
      }

      try {
        await repository.save(project);
        const updatedVodFiles = new Map(get().vodFiles);
        for (const [vodId, file] of vodFiles) {
          updatedVodFiles.set(vodId, file);
        }
        set({
          projects: sortProjects(
            get().projects.map((candidate) => (candidate.id === project.id ? project : candidate)),
          ),
          vodFiles: updatedVodFiles,
          errorMessage: undefined,
        });
        return true;
      } catch {
        set({ errorMessage: 'projects.errors.sources' });
        return false;
      }
    },

    saveSynchronization: async (projectId, vodId, anchor) => {
      const project = get().projects.find((candidate) => candidate.id === projectId);
      if (project === undefined) {
        set({ errorMessage: 'projects.errors.missing' });
        return false;
      }

      try {
        const updatedProject = synchronizeVod(project, vodId, anchor);
        await repository.save(updatedProject);
        set({
          projects: sortProjects(
            get().projects.map((candidate) =>
              candidate.id === projectId ? updatedProject : candidate,
            ),
          ),
          errorMessage: undefined,
        });
        return true;
      } catch {
        set({ errorMessage: 'projects.errors.synchronization' });
        return false;
      }
    },
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
