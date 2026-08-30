export function getPacketTimelineOrigin(
  videoStartSeconds: number,
  audioStartSeconds: number | undefined,
): number {
  return Math.min(videoStartSeconds, audioStartSeconds ?? videoStartSeconds);
}
