import { describe, expect, it, vi } from 'vitest';

import type { BrowserDirectoryHandle, BrowserWritableFileHandle } from './types';
import { createClipExportFileName, reserveUniqueOutputFile } from './losslessClipExporter';

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
});
