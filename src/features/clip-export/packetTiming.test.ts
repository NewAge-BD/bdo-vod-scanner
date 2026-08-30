import { describe, expect, it } from 'vitest';

import { getPacketTimelineOrigin } from './packetTiming';

describe('getPacketTimelineOrigin', () => {
  it('uses an earlier audio packet to prevent negative lossless timestamps', () => {
    expect(getPacketTimelineOrigin(777.099544, 777.085146)).toBe(777.085146);
  });

  it('keeps the video keyframe origin when audio starts later or is absent', () => {
    expect(getPacketTimelineOrigin(10, 10.01)).toBe(10);
    expect(getPacketTimelineOrigin(10, undefined)).toBe(10);
  });
});
