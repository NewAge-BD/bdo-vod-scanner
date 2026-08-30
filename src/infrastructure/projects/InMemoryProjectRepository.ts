import { portableProjectSchema, type PortableProject } from '../../domain/projects';
import type { ProjectRepository } from './ProjectRepository';

export class InMemoryProjectRepository implements ProjectRepository {
  readonly #projects = new Map<string, PortableProject>();

  list(): Promise<readonly PortableProject[]> {
    return Promise.resolve(
      [...this.#projects.values()].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
    );
  }

  get(id: string): Promise<PortableProject | undefined> {
    return Promise.resolve(this.#projects.get(id));
  }

  save(project: PortableProject): Promise<void> {
    const validatedProject = portableProjectSchema.parse(project);
    this.#projects.set(validatedProject.id, validatedProject);
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.#projects.delete(id);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.#projects.clear();
    return Promise.resolve();
  }
}
