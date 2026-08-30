import { useContext } from 'react';
import { useStore } from 'zustand';

import type { ProjectStoreState } from './projectStore';
import { ProjectStoreContext } from './projectStoreContext';

export function useProjectStore<T>(selector: (state: ProjectStoreState) => T): T {
  const store = useContext(ProjectStoreContext);
  if (store === undefined) {
    throw new Error('useProjectStore must be used inside ProjectStoreProvider.');
  }

  return useStore(store, selector);
}
