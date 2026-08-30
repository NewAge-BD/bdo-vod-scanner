import {
  BlobSource,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  Input,
  MP4,
  Mp4OutputFormat,
  Output,
  StreamTarget,
  type EncodedPacket,
} from 'mediabunny';

import type {
  ClipExportErrorCode,
  ClipExportWorkerRequest,
  ClipExportWorkerResponse,
  LosslessClipExportRequest,
} from './types';

interface WorkerScope {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<ClipExportWorkerRequest>) => void,
  ): void;
  postMessage(message: ClipExportWorkerResponse): void;
}

const workerScope = self as unknown as WorkerScope;
let activeController: AbortController | undefined;

workerScope.addEventListener('message', (event) => {
  if (event.data.type === 'cancel') {
    activeController?.abort();
    return;
  }
  if (activeController !== undefined) {
    return;
  }

  const controller = new AbortController();
  activeController = controller;
  void exportClip(event.data.request, controller.signal)
    .then((result) => workerScope.postMessage({ type: 'complete', result }))
    .catch((error: unknown) =>
      workerScope.postMessage({ type: 'error', code: classifyExportError(error) }),
    )
    .finally(() => {
      activeController = undefined;
    });
});

async function exportClip(request: LosslessClipExportRequest, signal: AbortSignal) {
  validateRange(request);
  const input = new Input({ source: new BlobSource(request.source), formats: [MP4] });
  let output: Output<Mp4OutputFormat, StreamTarget> | undefined;
  let outputBytes = 0;

  try {
    if (!(await input.canRead())) {
      throw new ClipExportWorkerError('unsupportedFormat');
    }
    const videoTrack = await input.getPrimaryVideoTrack();
    if (videoTrack === null) {
      throw new ClipExportWorkerError('missingVideoTrack');
    }
    const audioTrack = await input.getPrimaryAudioTrack();
    const videoCodec = await videoTrack.getCodec();
    const videoDecoderConfig = await videoTrack.getDecoderConfig();
    const audioCodec = audioTrack === null ? null : await audioTrack.getCodec();
    const audioDecoderConfig = audioTrack === null ? null : await audioTrack.getDecoderConfig();
    if (videoCodec === null || videoDecoderConfig === null) {
      throw new ClipExportWorkerError('unsupportedCodec');
    }
    if (audioTrack !== null && (audioCodec === null || audioDecoderConfig === null)) {
      throw new ClipExportWorkerError('unsupportedCodec');
    }

    const videoSink = new EncodedPacketSink(videoTrack);
    const startVideoPacket =
      (await videoSink.getKeyPacket(request.requestedInSeconds, {
        verifyKeyPackets: true,
      })) ?? (await videoSink.getFirstKeyPacket({ verifyKeyPackets: true }));
    if (startVideoPacket === null) {
      throw new ClipExportWorkerError('missingKeyframe');
    }
    const keyAtRequestedEnd =
      (await videoSink.getKeyPacket(request.requestedOutSeconds, {
        verifyKeyPackets: true,
      })) ?? startVideoPacket;
    const endVideoPacket =
      (await videoSink.getNextKeyPacket(keyAtRequestedEnd, { verifyKeyPackets: true })) ??
      undefined;
    const effectiveInSeconds = startVideoPacket.timestamp;
    const effectiveOutSeconds =
      endVideoPacket?.timestamp ?? (await input.computeDuration([videoTrack]));
    if (effectiveOutSeconds <= effectiveInSeconds) {
      throw new ClipExportWorkerError('missingKeyframe');
    }

    throwIfCancelled(signal);
    const writable = await request.destination.createWritable();
    const target = new StreamTarget(writable, { chunked: true });
    target.on('write', ({ end }) => {
      outputBytes = Math.max(outputBytes, end);
    });
    output = new Output({
      format: new Mp4OutputFormat({ fastStart: false }),
      target,
    });

    const videoSource = new EncodedVideoPacketSource(videoCodec);
    output.addVideoTrack(videoSource, {
      decoderConfig: videoDecoderConfig,
      hasOnlyKeyPackets: await videoTrack.hasOnlyKeyPackets(),
      rotation: await videoTrack.getRotation(),
    });

    const audioSource =
      audioTrack !== null && audioCodec !== null
        ? new EncodedAudioPacketSource(audioCodec)
        : undefined;
    if (
      audioSource !== undefined &&
      audioDecoderConfig !== null &&
      audioDecoderConfig !== undefined
    ) {
      output.addAudioTrack(audioSource, { decoderConfig: audioDecoderConfig });
    }

    await output.start();
    const reportProgress = createProgressReporter(effectiveInSeconds, effectiveOutSeconds);
    const pumps: Promise<void>[] = [
      pumpVideoPackets({
        decoderConfig: videoDecoderConfig,
        endPacket: endVideoPacket,
        originSeconds: effectiveInSeconds,
        reportProgress,
        signal,
        sink: videoSink,
        source: videoSource,
        startPacket: startVideoPacket,
      }),
    ];
    if (audioTrack !== null && audioSource !== undefined && audioDecoderConfig !== null) {
      const audioSink = new EncodedPacketSink(audioTrack);
      const startAudioPacket =
        (await audioSink.getPacket(effectiveInSeconds)) ??
        (await audioSink.getFirstPacket()) ??
        undefined;
      const audioPacketAtEnd = await audioSink.getPacket(effectiveOutSeconds, {
        metadataOnly: true,
      });
      const endAudioPacket =
        audioPacketAtEnd === null
          ? undefined
          : ((await audioSink.getNextPacket(audioPacketAtEnd, { metadataOnly: true })) ??
            undefined);
      if (startAudioPacket !== undefined) {
        pumps.push(
          pumpAudioPackets({
            decoderConfig: audioDecoderConfig,
            endPacket: endAudioPacket,
            originSeconds: effectiveInSeconds,
            reportProgress,
            signal,
            sink: audioSink,
            source: audioSource,
            startPacket: startAudioPacket,
          }),
        );
      } else {
        audioSource.close();
      }
    }

    await Promise.all(pumps);
    throwIfCancelled(signal);
    await output.finalize();
    reportProgress(effectiveOutSeconds, true);
    return { effectiveInSeconds, effectiveOutSeconds, outputBytes };
  } catch (error: unknown) {
    if (output !== undefined && output.state !== 'finalized' && output.state !== 'canceled') {
      await output.cancel().catch(() => undefined);
    }
    throw error;
  } finally {
    input.dispose();
  }
}

async function pumpVideoPackets({
  decoderConfig,
  endPacket,
  originSeconds,
  reportProgress,
  signal,
  sink,
  source,
  startPacket,
}: {
  readonly decoderConfig: VideoDecoderConfig;
  readonly endPacket: EncodedPacket | undefined;
  readonly originSeconds: number;
  readonly reportProgress: (timestamp: number, force?: boolean) => void;
  readonly signal: AbortSignal;
  readonly sink: EncodedPacketSink;
  readonly source: EncodedVideoPacketSource;
  readonly startPacket: EncodedPacket;
}) {
  let first = true;
  for await (const packet of sink.packets(startPacket, endPacket)) {
    throwIfCancelled(signal);
    const shiftedPacket = packet.clone({ timestamp: packet.timestamp - originSeconds });
    await source.add(shiftedPacket, first ? { decoderConfig } : undefined);
    first = false;
    reportProgress(packet.timestamp);
  }
  source.close();
}

async function pumpAudioPackets({
  decoderConfig,
  endPacket,
  originSeconds,
  reportProgress,
  signal,
  sink,
  source,
  startPacket,
}: {
  readonly decoderConfig: AudioDecoderConfig;
  readonly endPacket: EncodedPacket | undefined;
  readonly originSeconds: number;
  readonly reportProgress: (timestamp: number, force?: boolean) => void;
  readonly signal: AbortSignal;
  readonly sink: EncodedPacketSink;
  readonly source: EncodedAudioPacketSource;
  readonly startPacket: EncodedPacket;
}) {
  let first = true;
  for await (const packet of sink.packets(startPacket, endPacket)) {
    throwIfCancelled(signal);
    const shiftedPacket = packet.clone({ timestamp: packet.timestamp - originSeconds });
    await source.add(shiftedPacket, first ? { decoderConfig } : undefined);
    first = false;
    reportProgress(packet.timestamp);
  }
  source.close();
}

function createProgressReporter(startSeconds: number, endSeconds: number) {
  const duration = endSeconds - startSeconds;
  let lastProgress = -1;
  return (timestamp: number, force = false) => {
    const progress = Math.min(1, Math.max(0, (timestamp - startSeconds) / duration));
    if (!force && progress - lastProgress < 0.01) {
      return;
    }
    lastProgress = progress;
    workerScope.postMessage({ type: 'progress', progress });
  };
}

function validateRange(request: LosslessClipExportRequest) {
  if (
    !Number.isFinite(request.requestedInSeconds) ||
    !Number.isFinite(request.requestedOutSeconds) ||
    request.requestedInSeconds < 0 ||
    request.requestedOutSeconds <= request.requestedInSeconds
  ) {
    throw new ClipExportWorkerError('unexpected');
  }
}

function throwIfCancelled(signal: AbortSignal) {
  if (signal.aborted) {
    throw new ClipExportWorkerError('cancelled');
  }
}

class ClipExportWorkerError extends Error {
  constructor(readonly code: ClipExportErrorCode) {
    super(code);
    this.name = 'ClipExportWorkerError';
  }
}

function classifyExportError(error: unknown): ClipExportErrorCode {
  if (error instanceof ClipExportWorkerError) {
    return error.code;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'cancelled';
  }
  if (
    error instanceof DOMException &&
    ['NotAllowedError', 'QuotaExceededError'].includes(error.name)
  ) {
    return 'writeFailed';
  }
  return 'unexpected';
}
