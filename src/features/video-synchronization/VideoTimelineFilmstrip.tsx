import { useEffect, useState } from 'react';

const FRAME_COUNT = 10;
const FRAME_WIDTH = 160;
const FRAME_HEIGHT = 90;
const EXTRACTION_DELAY_MS = 250;

interface VideoTimelineFilmstripProps {
  readonly endTimeSeconds: number;
  readonly source: string;
  readonly startTimeSeconds: number;
}

export function VideoTimelineFilmstrip({
  endTimeSeconds,
  source,
  startTimeSeconds,
}: VideoTimelineFilmstripProps) {
  const [frames, setFrames] = useState<readonly string[]>([]);

  useEffect(() => {
    const abortController = new AbortController();
    const timeout = window.setTimeout(() => {
      void extractFrames(source, startTimeSeconds, endTimeSeconds, abortController.signal).then(
        (nextFrames) => {
          if (!abortController.signal.aborted) {
            setFrames(nextFrames);
          }
        },
      );
    }, EXTRACTION_DELAY_MS);

    return () => {
      window.clearTimeout(timeout);
      abortController.abort();
    };
  }, [endTimeSeconds, source, startTimeSeconds]);

  return (
    <div aria-hidden="true" className="video-timeline__filmstrip">
      {frames.map((frame, index) => (
        <img
          alt=""
          draggable="false"
          key={`${startTimeSeconds}-${endTimeSeconds}-${index}`}
          src={frame}
        />
      ))}
    </div>
  );
}

async function extractFrames(
  source: string,
  startTimeSeconds: number,
  endTimeSeconds: number,
  signal: AbortSignal,
): Promise<readonly string[]> {
  if (source.length === 0 || endTimeSeconds <= startTimeSeconds) {
    return [];
  }
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'metadata';
  video.src = source;
  try {
    await waitForMediaEvent(video, 'loadedmetadata', signal);
    const maximumTime = Number.isFinite(video.duration) ? video.duration : endTimeSeconds;
    const canvas = document.createElement('canvas');
    canvas.width = FRAME_WIDTH;
    canvas.height = FRAME_HEIGHT;
    const context = canvas.getContext('2d');
    if (context === null) {
      return [];
    }
    const frames: string[] = [];
    for (let index = 0; index < FRAME_COUNT; index += 1) {
      if (signal.aborted) {
        return [];
      }
      const ratio = (index + 0.5) / FRAME_COUNT;
      const targetTime = Math.min(
        Math.max(0, maximumTime - 0.001),
        startTimeSeconds + (endTimeSeconds - startTimeSeconds) * ratio,
      );
      video.currentTime = targetTime;
      await waitForMediaEvent(video, 'seeked', signal);
      drawCoverFrame(context, video);
      frames.push(canvas.toDataURL('image/jpeg', 0.58));
    }
    return frames;
  } catch {
    return [];
  } finally {
    video.removeAttribute('src');
  }
}

function waitForMediaEvent(
  video: HTMLVideoElement,
  eventName: 'loadedmetadata' | 'seeked',
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanUp = () => {
      video.removeEventListener(eventName, onSuccess);
      video.removeEventListener('error', onError);
      signal.removeEventListener('abort', onAbort);
    };
    const onSuccess = () => {
      cleanUp();
      resolve();
    };
    const onError = () => {
      cleanUp();
      reject(new Error('Video frame extraction failed.'));
    };
    const onAbort = () => {
      cleanUp();
      reject(new DOMException('Video frame extraction cancelled.', 'AbortError'));
    };
    video.addEventListener(eventName, onSuccess, { once: true });
    video.addEventListener('error', onError, { once: true });
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function drawCoverFrame(context: CanvasRenderingContext2D, video: HTMLVideoElement) {
  const sourceWidth = Math.max(1, video.videoWidth);
  const sourceHeight = Math.max(1, video.videoHeight);
  const scale = Math.max(FRAME_WIDTH / sourceWidth, FRAME_HEIGHT / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  context.drawImage(video, (FRAME_WIDTH - width) / 2, (FRAME_HEIGHT - height) / 2, width, height);
}
