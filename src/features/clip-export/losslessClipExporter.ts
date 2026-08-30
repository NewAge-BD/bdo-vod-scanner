import type {
  BrowserDirectoryHandle,
  BrowserWritableFileHandle,
  ClipExportErrorCode,
  ClipExportWorkerRequest,
  ClipExportWorkerResponse,
  LosslessClipExportRequest,
  LosslessClipExportResult,
} from './types';

export function supportsLosslessClipExport(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.showDirectoryPicker === 'function' &&
    typeof Worker !== 'undefined'
  );
}

export function createClipExportFileName(
  sessionDate: string | null,
  clipTitle: string,
  matchingEventCount: number,
): string {
  const date = sessionDate ?? 'unknown-date';
  const safeTitle = replaceInvalidFileNameCharacters(clipTitle.normalize('NFKC'))
    .replace(/_+/g, '_')
    .replace(/[._ ]+$/g, '')
    .trim()
    .slice(0, 120);
  return `${date}_${safeTitle || 'clip'}_${matchingEventCount}.mp4`;
}

function replaceInvalidFileNameCharacters(value: string): string {
  const forbiddenCharacters = '<>:"/\\|?*';
  return [...value]
    .map((character) =>
      forbiddenCharacters.includes(character) || character.charCodeAt(0) < 32 ? '_' : character,
    )
    .join('');
}

export async function reserveUniqueOutputFile(
  directory: BrowserDirectoryHandle,
  requestedName: string,
): Promise<{ readonly fileName: string; readonly handle: BrowserWritableFileHandle }> {
  const extensionIndex = requestedName.toLowerCase().endsWith('.mp4')
    ? requestedName.length - 4
    : requestedName.length;
  const stem = requestedName.slice(0, extensionIndex);
  const extension = requestedName.slice(extensionIndex);

  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const fileName = suffix === 1 ? requestedName : `${stem}_${suffix}${extension}`;
    try {
      await directory.getFileHandle(fileName);
    } catch (error: unknown) {
      if (isNotFoundError(error)) {
        return {
          fileName,
          handle: await directory.getFileHandle(fileName, { create: true }),
        };
      }
      throw error;
    }
  }
  throw new Error('Could not reserve a unique clip export filename.');
}

export function exportLosslessClip(
  request: LosslessClipExportRequest,
  options: {
    readonly signal: AbortSignal;
    readonly onProgress: (progress: number) => void;
    readonly onPhase: (phase: 'analyzing' | 'writing') => void;
  },
): Promise<LosslessClipExportResult> {
  const worker = new Worker(new URL('./clipExport.worker.ts', import.meta.url), {
    type: 'module',
  });

  return new Promise((resolve, reject) => {
    const cancel = () => {
      const message: ClipExportWorkerRequest = { type: 'cancel' };
      worker.postMessage(message);
    };
    const cleanup = () => {
      options.signal.removeEventListener('abort', cancel);
      worker.terminate();
    };
    options.signal.addEventListener('abort', cancel, { once: true });
    worker.addEventListener('message', (event: MessageEvent<ClipExportWorkerResponse>) => {
      if (event.data.type === 'phase') {
        options.onPhase(event.data.phase);
        return;
      }
      if (event.data.type === 'progress') {
        options.onProgress(event.data.progress);
        return;
      }
      cleanup();
      if (event.data.type === 'complete') {
        resolve(event.data.result);
      } else {
        reject(new LosslessClipExportError(event.data.code));
      }
    });
    worker.addEventListener('error', () => {
      cleanup();
      reject(new LosslessClipExportError('unexpected'));
    });
    const message: ClipExportWorkerRequest = { type: 'start', request };
    worker.postMessage(message);
  });
}

export class LosslessClipExportError extends Error {
  constructor(readonly code: ClipExportErrorCode) {
    super(code);
    this.name = 'LosslessClipExportError';
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'NotFoundError') ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'NotFoundError')
  );
}
