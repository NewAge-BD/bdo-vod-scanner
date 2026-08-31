import { describe, expect, it } from 'vitest';

import { hasMp4FileSignature, isLogFileName, isMp4FileName } from './fileValidation';

describe('source file validation', () => {
  it.each(['2026-08-29.log', 'SESSION.LOG', 'siege_2026-08-29.ikusa.json'])(
    'recognizes log extensions for %s',
    (fileName) => {
      expect(isLogFileName(fileName)).toBe(true);
    },
  );

  it.each(['perspective.mp4', 'PERSPECTIVE.MP4'])(
    'recognizes MP4 extensions for %s',
    (fileName) => {
      expect(isMp4FileName(fileName)).toBe(true);
    },
  );

  it('checks the ISO base media file type box instead of trusting the extension', () => {
    expect(hasMp4FileSignature(new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]))).toBe(true);
    expect(hasMp4FileSignature(new TextEncoder().encode('not an mp4'))).toBe(false);
    expect(hasMp4FileSignature(new Uint8Array([0, 1, 2]))).toBe(false);
  });
});
