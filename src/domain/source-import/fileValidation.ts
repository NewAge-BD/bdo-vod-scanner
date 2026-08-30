const MP4_BOX_TYPE_OFFSET = 4;
const MP4_FILE_TYPE_BOX = 'ftyp';

export const MAX_RAW_LOG_BYTES = 5_000_000;

export function isLogFileName(fileName: string): boolean {
  return fileName.toLocaleLowerCase('en-US').endsWith('.log');
}

export function isMp4FileName(fileName: string): boolean {
  return fileName.toLocaleLowerCase('en-US').endsWith('.mp4');
}

export function hasMp4FileSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 8) {
    return false;
  }

  return readAscii(bytes, MP4_BOX_TYPE_OFFSET, 4) === MP4_FILE_TYPE_BOX;
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}
