import type { StreamTargetChunk } from 'mediabunny';

export interface BrowserWritableFileHandle {
  readonly name: string;
  createWritable(): Promise<WritableStream<StreamTargetChunk>>;
}

export interface BrowserDirectoryHandle {
  getFileHandle(
    name: string,
    options?: { readonly create?: boolean },
  ): Promise<BrowserWritableFileHandle>;
  removeEntry(name: string): Promise<void>;
}

export interface LosslessClipExportRequest {
  readonly source: File;
  readonly destination: BrowserWritableFileHandle;
  readonly requestedInSeconds: number;
  readonly requestedOutSeconds: number;
}

export interface LosslessClipExportResult {
  readonly effectiveInSeconds: number;
  readonly effectiveOutSeconds: number;
  readonly outputBytes: number;
}

export type ClipExportErrorCode =
  | 'cancelled'
  | 'missingKeyframe'
  | 'missingVideoTrack'
  | 'unsupportedCodec'
  | 'unsupportedFormat'
  | 'writeFailed'
  | 'unexpected';

export type ClipExportWorkerRequest =
  | { readonly type: 'start'; readonly request: LosslessClipExportRequest }
  | { readonly type: 'cancel' };

export type ClipExportWorkerResponse =
  | { readonly type: 'progress'; readonly progress: number }
  | { readonly type: 'complete'; readonly result: LosslessClipExportResult }
  | { readonly type: 'error'; readonly code: ClipExportErrorCode };

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      readonly id?: string;
      readonly mode?: 'read' | 'readwrite';
      readonly startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
    }) => Promise<BrowserDirectoryHandle>;
  }
}
