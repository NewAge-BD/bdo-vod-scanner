import type { InspectedVideoMetadata, VideoMetadataInspector } from './VideoMetadataInspector';

const METADATA_TIMEOUT_MS = 15_000;

export class NativeVideoMetadataInspector implements VideoMetadataInspector {
  inspect(file: File): Promise<InspectedVideoMetadata> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const objectUrl = URL.createObjectURL(file);
      const timeout = window.setTimeout(
        () => finishWithError('Video metadata timed out.'),
        METADATA_TIMEOUT_MS,
      );

      const cleanUp = () => {
        window.clearTimeout(timeout);
        video.onloadedmetadata = null;
        video.onerror = null;
        video.removeAttribute('src');
        video.load();
        URL.revokeObjectURL(objectUrl);
      };

      const finishWithError = (message: string) => {
        cleanUp();
        reject(new Error(message));
      };

      video.preload = 'metadata';
      video.muted = true;
      video.onloadedmetadata = () => {
        const metadata: InspectedVideoMetadata = {
          durationSeconds: finitePositiveOrNull(video.duration),
          width: positiveIntegerOrNull(video.videoWidth),
          height: positiveIntegerOrNull(video.videoHeight),
          nominalFrameRate: null,
          variableFrameRate: null,
          videoCodec: null,
          audioCodec: null,
        };
        cleanUp();
        resolve(metadata);
      };
      video.onerror = () => finishWithError('The browser could not decode this MP4 metadata.');
      video.src = objectUrl;
      video.load();
    });
  }
}

function finitePositiveOrNull(value: number): number | null {
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function positiveIntegerOrNull(value: number): number | null {
  return Number.isInteger(value) && value > 0 ? value : null;
}
