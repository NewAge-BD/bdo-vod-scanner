import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BrowserDirectoryHandle, BrowserWritableFileHandle } from './types';
import {
  createClipExportFileName,
  exportLosslessClip,
  reserveUniqueOutputFile,
} from './losslessClipExporter';
import type { ClipExportWorkerResponse } from './types';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('losslessClipExporter', () => {
  it('creates a safe date, title, and event-count filename', () => {
    expect(createClipExportFileName('2026-08-29', 'NewAge: Finals?', 3)).toBe(
      '2026-08-29_NewAge_ Finals_3.mp4',
    );
  });

  it('adds a numeric suffix without overwriting an existing clip', async () => {
    const createdHandle = {
      name: '2026-08-29_NewAge_3_2.mp4',
      createWritable: vi.fn(),
    } as unknown as BrowserWritableFileHandle;
    const getFileHandle = vi.fn((name: string, options?: { readonly create?: boolean }) => {
      if (name === '2026-08-29_NewAge_3.mp4') {
        return Promise.resolve(createdHandle);
      }
      if (options?.create === true) {
        return Promise.resolve(createdHandle);
      }
      return Promise.reject(new DOMException('Missing', 'NotFoundError'));
    });
    const directory = {
      getFileHandle,
      removeEntry: vi.fn(),
    } as unknown as BrowserDirectoryHandle;

    const output = await reserveUniqueOutputFile(directory, '2026-08-29_NewAge_3.mp4');

    expect(output.fileName).toBe('2026-08-29_NewAge_3_2.mp4');
    expect(getFileHandle).toHaveBeenLastCalledWith('2026-08-29_NewAge_3_2.mp4', {
      create: true,
    });
  });

  it('forwards analysis and writing progress from the export worker', async () => {
    const worker = new FakeWorker();
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          return worker;
        }
      },
    );
    const onPhase = vi.fn();
    const onProgress = vi.fn();
    const controller = new AbortController();
    const destination = {
      name: 'clip.mp4',
      createWritable: vi.fn(),
    } as unknown as BrowserWritableFileHandle;

    const exported = exportLosslessClip(
      {
        destination,
        requestedInSeconds: 10,
        requestedOutSeconds: 12,
        source: new File(['vod'], 'Perspective.mp4'),
      },
      { onPhase, onProgress, signal: controller.signal },
    );
    worker.emit({ type: 'phase', phase: 'analyzing' });
    worker.emit({ type: 'phase', phase: 'writing' });
    worker.emit({ type: 'progress', progress: 0.5 });
    worker.emit({
      type: 'complete',
      result: { effectiveInSeconds: 9, effectiveOutSeconds: 13, outputBytes: 42 },
    });

    await expect(exported).resolves.toEqual({
      effectiveInSeconds: 9,
      effectiveOutSeconds: 13,
      outputBytes: 42,
    });
    expect(onPhase).toHaveBeenNthCalledWith(1, 'analyzing');
    expect(onPhase).toHaveBeenNthCalledWith(2, 'writing');
    expect(onProgress).toHaveBeenCalledWith(0.5);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});

class FakeWorker {
  readonly terminate = vi.fn();
  private messageListener?: (event: MessageEvent<ClipExportWorkerResponse>) => void;

  addEventListener(type: string, listener: EventListener) {
    if (type === 'message') {
      this.messageListener = listener;
    }
  }

  postMessage() {}

  emit(data: ClipExportWorkerResponse) {
    this.messageListener?.({ data } as MessageEvent<ClipExportWorkerResponse>);
  }
}
