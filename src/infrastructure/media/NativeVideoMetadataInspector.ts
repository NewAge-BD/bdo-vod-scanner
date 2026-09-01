import type { InspectedVideoMetadata, VideoMetadataInspector } from './VideoMetadataInspector';

const METADATA_TIMEOUT_MS = 15_000;
const FRAME_RATE_SAMPLE_SIZE = 256;

export class NativeVideoMetadataInspector implements VideoMetadataInspector {
  async inspect(file: File): Promise<InspectedVideoMetadata> {
    try {
      return await inspectMp4Container(file);
    } catch {
      return inspectNativePlaybackMetadata(file);
    }
  }
}

async function inspectMp4Container(file: File): Promise<InspectedVideoMetadata> {
  const { BlobSource, Input, MP4 } = await import('mediabunny');
  const input = new Input({
    source: new BlobSource(file, { maxCacheSize: 8 * 1024 * 1024 }),
    formats: [MP4],
  });

  try {
    if (!(await input.canRead())) {
      throw new Error('The MP4 container could not be read.');
    }

    const [videoTrack, audioTrack, durationSeconds] = await Promise.all([
      input.getPrimaryVideoTrack(),
      input.getPrimaryAudioTrack(),
      input.getDurationFromMetadata(),
    ]);
    if (videoTrack === null) {
      throw new Error('The MP4 does not contain a video track.');
    }

    const [width, height, videoCodec, audioCodec, frameRateMetrics] = await Promise.all([
      videoTrack.getDisplayWidth(),
      videoTrack.getDisplayHeight(),
      videoTrack.getCodec(),
      audioTrack?.getCodec() ?? Promise.resolve(null),
      videoTrack
        .computeFrameRateMetrics({ targetPacketCount: FRAME_RATE_SAMPLE_SIZE })
        .catch(() => null),
    ]);

    return {
      durationSeconds: finitePositiveOrNull(durationSeconds),
      width: positiveIntegerOrNull(width),
      height: positiveIntegerOrNull(height),
      nominalFrameRate: finitePositiveOrNull(frameRateMetrics?.bestGuessFrameRate ?? null),
      variableFrameRate:
        frameRateMetrics === null ? null : frameRateMetrics.underlyingFrameRate === null,
      videoCodec,
      audioCodec,
    };
  } finally {
    input.dispose();
  }
}

function inspectNativePlaybackMetadata(file: File): Promise<InspectedVideoMetadata> {
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

function finitePositiveOrNull(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
}

function positiveIntegerOrNull(value: number): number | null {
  return Number.isInteger(value) && value > 0 ? value : null;
}
