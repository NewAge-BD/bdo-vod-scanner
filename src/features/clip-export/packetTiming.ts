export function getPacketTimelineOrigin(
  videoStartSeconds: number,
  audioStartSeconds: number | undefined,
): number {
  return Math.min(videoStartSeconds, audioStartSeconds ?? videoStartSeconds);
}

export function getPacketTimelineEnd(
  videoEndSeconds: number,
  audioEndBoundarySeconds: number | undefined,
): number {
  return Math.max(videoEndSeconds, audioEndBoundarySeconds ?? videoEndSeconds);
}
