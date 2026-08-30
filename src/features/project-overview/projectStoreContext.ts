import { createContext } from 'react';
import type { StoreApi } from 'zustand/vanilla';

import type { ProjectStoreState } from './projectStore';

export const ProjectStoreContext = createContext<StoreApi<ProjectStoreState> | undefined>(
  undefined,
);
