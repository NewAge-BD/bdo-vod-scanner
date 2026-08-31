import {
  buildBackwardVisibilityProbeTimes,
  buildCenteredSampleTimes,
  findBestAutoSyncMatch,
  isAutoSyncEventVisible,
  type AutoSyncRegion,
} from '../../domain/auto-sync';
import type { BdoEvent } from '../../domain/events';

const MAXIMUM_BINARY_REFINEMENT_ITERATIONS = 20;
const MINIMUM_REFINEMENT_INTERVAL_SECONDS = 0.1;

export type AutoSyncScanPhase = 'loading' | 'sampling' | 'refining';

export interface AutoSyncScanProgress {
  readonly completed: number;
  readonly phase: AutoSyncScanPhase;
  readonly total: number;
}

export interface AutoSyncScanResult {
  readonly confidence: number;
  readonly event: BdoEvent;
  readonly previewDataUrl: string;
  readonly recognizedLine: string;
  readonly videoTimeSeconds: number;
}

export async function scanVideoForSynchronization({
  events,
  file,
  region,
  signal,
  startTimeSeconds,
  onProgress,
}: {
  readonly events: readonly BdoEvent[];
  readonly file: File;
  readonly region: AutoSyncRegion;
  readonly signal: AbortSignal;
  readonly startTimeSeconds: number;
  readonly onProgress: (progress: AutoSyncScanProgress) => void;
}): Promise<AutoSyncScanResult | undefined> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.src = objectUrl;

  let worker: Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>> | undefined;

  try {
    onProgress({ completed: 0, phase: 'loading', total: 1 });
    await waitForMetadata(video, signal);
    throwIfAborted(signal);

    const { createWorker, OEM, PSM } = await import('tesseract.js');
    const assetRoot = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href);
    worker = await createWorker('eng', OEM.LSTM_ONLY, {
      corePath: new URL('core', assetRoot).href,
      gzip: true,
      langPath: new URL('lang', assetRoot).href.replace(/\/$/, ''),
      workerPath: new URL('worker.min.js', assetRoot).href,
    });
    await worker.setParameters({
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      user_defined_dpi: '300',
    });
    throwIfAborted(signal);

    const sampleTimes = buildCenteredSampleTimes(
      video.duration,
      startTimeSeconds,
      undefined,
      undefined,
    );

    for (const [sampleIndex, sampleTime] of sampleTimes.entries()) {
      throwIfAborted(signal);
      onProgress({ completed: sampleIndex, phase: 'sampling', total: sampleTimes.length });
      const sample = await recognizeAtTime(video, sampleTime, region, worker, signal);
      const match = findBestAutoSyncMatch(sample.text, events);
      if (match === undefined) {
        continue;
      }

      const refinedTime = await refineFirstVisibleTime({
        event: match.event,
        initialVisibleTime: sampleTime,
        onProgress,
        region,
        signal,
        video,
        worker,
      });
      await seekVideo(video, refinedTime, signal);
      const previewCanvas = captureChatRegion(video, region);

      return {
        confidence: match.confidence,
        event: match.event,
        previewDataUrl: previewCanvas.toDataURL('image/jpeg', 0.78),
        recognizedLine: match.line,
        videoTimeSeconds: refinedTime,
      };
    }

    onProgress({ completed: sampleTimes.length, phase: 'sampling', total: sampleTimes.length });
    return undefined;
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(objectUrl);
    await worker?.terminate().catch(() => undefined);
  }
}

async function refineFirstVisibleTime({
  event,
  initialVisibleTime,
  onProgress,
  region,
  signal,
  video,
  worker,
}: {
  readonly event: BdoEvent;
  readonly initialVisibleTime: number;
  readonly onProgress: (progress: AutoSyncScanProgress) => void;
  readonly region: AutoSyncRegion;
  readonly signal: AbortSignal;
  readonly video: HTMLVideoElement;
  readonly worker: Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>>;
}): Promise<number> {
  const probeTimes = buildBackwardVisibilityProbeTimes(initialVisibleTime);
  const totalSteps = probeTimes.length + MAXIMUM_BINARY_REFINEMENT_ITERATIONS;
  let firstVisible = initialVisibleTime;
  let lastHidden: number | undefined;

  for (const [probeIndex, time] of probeTimes.entries()) {
    throwIfAborted(signal);
    onProgress({ completed: probeIndex, phase: 'refining', total: totalSteps });
    const sample = await recognizeAtTime(video, time, region, worker, signal);
    if (!isAutoSyncEventVisible(sample.text, event)) {
      lastHidden = time;
      break;
    }
    firstVisible = time;
    if (time === 0) {
      return 0;
    }
  }

  if (lastHidden === undefined) {
    return firstVisible;
  }

  let hiddenTime: number = lastHidden;
  for (let iteration = 0; iteration < MAXIMUM_BINARY_REFINEMENT_ITERATIONS; iteration += 1) {
    throwIfAborted(signal);
    const midpoint: number = (hiddenTime + firstVisible) / 2;
    if (firstVisible - hiddenTime < MINIMUM_REFINEMENT_INTERVAL_SECONDS) {
      break;
    }
    onProgress({
      completed: probeTimes.length + iteration,
      phase: 'refining',
      total: totalSteps,
    });
    const sample = await recognizeAtTime(video, midpoint, region, worker, signal);
    if (isAutoSyncEventVisible(sample.text, event)) {
      firstVisible = midpoint;
    } else {
      hiddenTime = midpoint;
    }
  }

  return firstVisible;
}

async function recognizeAtTime(
  video: HTMLVideoElement,
  timeSeconds: number,
  region: AutoSyncRegion,
  worker: Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>>,
  signal: AbortSignal,
): Promise<{ readonly text: string }> {
  await seekVideo(video, timeSeconds, signal);
  const canvas = captureChatRegion(video, region);
  throwIfAborted(signal);
  const result = await worker.recognize(canvas);
  throwIfAborted(signal);
  return { text: result.data.text };
}

function captureChatRegion(video: HTMLVideoElement, region: AutoSyncRegion): HTMLCanvasElement {
  const sourceX = Math.round(region.x * video.videoWidth);
  const sourceY = Math.round(region.y * video.videoHeight);
  const sourceWidth = Math.max(1, Math.round(region.width * video.videoWidth));
  const sourceHeight = Math.max(1, Math.round(region.height * video.videoHeight));
  const scale = Math.min(3, Math.max(1.5, 1400 / sourceWidth));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceHeight * scale);
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Canvas is unavailable.');
  }

  context.drawImage(
    video,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

function waitForMetadata(video: HTMLVideoElement, signal: AbortSignal): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', handleLoaded);
      video.removeEventListener('error', handleError);
      signal.removeEventListener('abort', handleAbort);
    };
    const handleLoaded = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error('The recording could not be opened for automatic synchronization.'));
    };
    const handleAbort = () => {
      cleanup();
      reject(new DOMException('Automatic synchronization was cancelled.', 'AbortError'));
    };
    video.addEventListener('loadedmetadata', handleLoaded, { once: true });
    video.addEventListener('error', handleError, { once: true });
    signal.addEventListener('abort', handleAbort, { once: true });
    video.load();
  });
}

function seekVideo(
  video: HTMLVideoElement,
  timeSeconds: number,
  signal: AbortSignal,
): Promise<void> {
  const safeTime = Math.min(video.duration, Math.max(0, timeSeconds));
  if (Math.abs(video.currentTime - safeTime) < 0.02 && video.readyState >= 2) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
      signal.removeEventListener('abort', handleAbort);
    };
    const handleSeeked = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error('A video frame could not be read.'));
    };
    const handleAbort = () => {
      cleanup();
      reject(new DOMException('Automatic synchronization was cancelled.', 'AbortError'));
    };
    video.addEventListener('seeked', handleSeeked, { once: true });
    video.addEventListener('error', handleError, { once: true });
    signal.addEventListener('abort', handleAbort, { once: true });
    video.currentTime = safeTime;
  });
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException('Automatic synchronization was cancelled.', 'AbortError');
  }
}
