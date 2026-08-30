import { useState, type PropsWithChildren } from 'react';

import { IndexedDbProjectRepository, type ProjectRepository } from '../../infrastructure/projects';
import { createProjectStore } from './projectStore';
import { ProjectStoreContext } from './projectStoreContext';
const defaultRepository = new IndexedDbProjectRepository();

interface ProjectStoreProviderProps extends PropsWithChildren {
  readonly repository?: ProjectRepository;
}

export function ProjectStoreProvider({ children, repository }: ProjectStoreProviderProps) {
  const [store] = useState(() => createProjectStore(repository ?? defaultRepository));

  return <ProjectStoreContext.Provider value={store}>{children}</ProjectStoreContext.Provider>;
}
