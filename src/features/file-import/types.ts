import type { PortableProject } from '../../domain/projects';

export type SourceImportIssueCode =
  | 'duplicateVod'
  | 'invalidMp4'
  | 'metadataUnavailable'
  | 'relinkedVod'
  | 'tooManyVods'
  | 'unsupportedFile';

export interface SourceImportIssue {
  readonly code: SourceImportIssueCode;
  readonly fileName?: string;
}

export interface SourceImportResult {
  readonly project: PortableProject;
  readonly vodFiles: ReadonlyMap<string, File>;
  readonly importedLog: boolean;
  readonly importedVodCount: number;
  readonly relinkedVodCount: number;
  readonly eventCount: number;
  readonly logIssueCount: number;
  readonly issues: readonly SourceImportIssue[];
}

export type SourceImportErrorCode =
  | 'emptySelection'
  | 'existingLog'
  | 'invalidLog'
  | 'logTooLarge'
  | 'multipleLogs'
  | 'noUsableFiles';

export class SourceImportError extends Error {
  constructor(readonly code: SourceImportErrorCode) {
    super(code);
    this.name = 'SourceImportError';
  }
}
