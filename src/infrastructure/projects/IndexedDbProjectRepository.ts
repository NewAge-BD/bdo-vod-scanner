import { portableProjectSchema, type PortableProject } from '../../domain/projects';
import type { ProjectRepository } from './ProjectRepository';

const DATABASE_NAME = 'bdo-vod-scanner';
const DATABASE_VERSION = 1;
const PROJECT_STORE = 'projects';

export class IndexedDbProjectRepository implements ProjectRepository {
  async list(): Promise<readonly PortableProject[]> {
    const database = await openDatabase();
    const transaction = database.transaction(PROJECT_STORE, 'readonly');
    const completed = transactionToPromise(transaction);
    const projects = await requestToPromise<unknown[]>(
      transaction.objectStore(PROJECT_STORE).getAll(),
    );
    await completed;
    database.close();

    return projects
      .map((project) => portableProjectSchema.parse(project))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async get(id: string): Promise<PortableProject | undefined> {
    const database = await openDatabase();
    const transaction = database.transaction(PROJECT_STORE, 'readonly');
    const completed = transactionToPromise(transaction);
    const project = await requestToPromise<unknown>(transaction.objectStore(PROJECT_STORE).get(id));
    await completed;
    database.close();

    return project === undefined ? undefined : portableProjectSchema.parse(project);
  }

  async save(project: PortableProject): Promise<void> {
    const validatedProject = portableProjectSchema.parse(project);
    const database = await openDatabase();
    const transaction = database.transaction(PROJECT_STORE, 'readwrite');
    const completed = transactionToPromise(transaction);
    transaction.objectStore(PROJECT_STORE).put(validatedProject);
    await completed;
    database.close();
  }

  async delete(id: string): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(PROJECT_STORE, 'readwrite');
    const completed = transactionToPromise(transaction);
    transaction.objectStore(PROJECT_STORE).delete(id);
    await completed;
    database.close();
  }

  async clear(): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(PROJECT_STORE, 'readwrite');
    const completed = transactionToPromise(transaction);
    transaction.objectStore(PROJECT_STORE).clear();
    await completed;
    database.close();
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECT_STORE)) {
        const store = database.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open project storage.'));
    request.onblocked = () => reject(new Error('Project storage upgrade is blocked.'));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Project storage request failed.'));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Project storage failed.'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Project storage was aborted.'));
  });
}
