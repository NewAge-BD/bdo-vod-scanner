import { portableProjectSchema, type PortableProject } from '../projects';

export interface SynchronizationAnchorInput {
  readonly eventId: string;
  readonly eventSessionTimeSeconds: number;
  readonly videoTimeSeconds: number;
}

export function synchronizeVod(
  project: PortableProject,
  vodId: string,
  input: SynchronizationAnchorInput,
  now = new Date(),
): PortableProject {
  if (!project.vods.some((vod) => vod.id === vodId)) {
    throw new Error('The selected VOD does not exist in this project.');
  }

  return portableProjectSchema.parse({
    ...project,
    updatedAt: now.toISOString(),
    vods: project.vods.map((vod) =>
      vod.id === vodId
        ? {
            ...vod,
            synchronizationAnchor: {
              eventId: input.eventId,
              eventSessionTimeSeconds: input.eventSessionTimeSeconds,
              videoTimeSeconds: input.videoTimeSeconds,
              offsetSeconds: input.videoTimeSeconds - input.eventSessionTimeSeconds,
            },
          }
        : vod,
    ),
  });
}

export function mapSessionTimeToVideoTime(
  anchor: SynchronizationAnchorInput,
  eventSessionTimeSeconds: number,
): number {
  return anchor.videoTimeSeconds + (eventSessionTimeSeconds - anchor.eventSessionTimeSeconds);
}

export function mapVideoTimeToSessionTime(
  anchor: SynchronizationAnchorInput,
  videoTimeSeconds: number,
): number {
  return anchor.eventSessionTimeSeconds + (videoTimeSeconds - anchor.videoTimeSeconds);
}
