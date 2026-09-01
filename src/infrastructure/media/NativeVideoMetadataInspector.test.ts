import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NativeVideoMetadataInspector } from './NativeVideoMetadataInspector';

const mediaMocks = vi.hoisted(() => ({
  audioCodec: vi.fn(),
  canRead: vi.fn(),
  dispose: vi.fn(),
  duration: vi.fn(),
  frameRate: vi.fn(),
  getAudioTrack: vi.fn(),
  getVideoTrack: vi.fn(),
  height: vi.fn(),
  videoCodec: vi.fn(),
  width: vi.fn(),
}));

vi.mock('mediabunny', () => ({
  BlobSource: class MockBlobSource {},
  Input: class MockInput {
    canRead = mediaMocks.canRead;
    dispose = mediaMocks.dispose;
    getDurationFromMetadata = mediaMocks.duration;
    getPrimaryAudioTrack = mediaMocks.getAudioTrack;
    getPrimaryVideoTrack = mediaMocks.getVideoTrack;
  },
  MP4: {},
}));

describe('NativeVideoMetadataInspector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mediaMocks.canRead.mockResolvedValue(true);
    mediaMocks.duration.mockResolvedValue(3_600.5);
    mediaMocks.width.mockResolvedValue(2560);
    mediaMocks.height.mockResolvedValue(1440);
    mediaMocks.videoCodec.mockResolvedValue('avc');
    mediaMocks.audioCodec.mockResolvedValue('aac');
    mediaMocks.frameRate.mockResolvedValue({
      bestGuessFrameRate: 59.94,
      frameRateIsConstant: false,
      underlyingFrameRate: null,
    });
    mediaMocks.getVideoTrack.mockResolvedValue({
      computeFrameRateMetrics: mediaMocks.frameRate,
      getCodec: mediaMocks.videoCodec,
      getDisplayHeight: mediaMocks.height,
      getDisplayWidth: mediaMocks.width,
    });
    mediaMocks.getAudioTrack.mockResolvedValue({ getCodec: mediaMocks.audioCodec });
  });

  it('reads codecs and sampled frame-rate information from the local MP4 container', async () => {
    const inspector = new NativeVideoMetadataInspector();

    await expect(inspector.inspect(new File(['mp4'], 'Perspective.mp4'))).resolves.toEqual({
      durationSeconds: 3_600.5,
      width: 2560,
      height: 1440,
      nominalFrameRate: 59.94,
      variableFrameRate: true,
      videoCodec: 'avc',
      audioCodec: 'aac',
    });
    expect(mediaMocks.frameRate).toHaveBeenCalledWith({ targetPacketCount: 256 });
    expect(mediaMocks.dispose).toHaveBeenCalledOnce();
  });
});
