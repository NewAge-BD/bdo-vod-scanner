import type { PortableProject } from '../../domain/projects';

export interface ProjectRepository {
  list(): Promise<readonly PortableProject[]>;
  get(id: string): Promise<PortableProject | undefined>;
  save(project: PortableProject): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}
