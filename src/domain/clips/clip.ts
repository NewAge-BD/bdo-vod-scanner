import { portableProjectSchema, type PortableProject } from '../projects';

export interface CreateClipInput {
  readonly inPointSeconds: number;
  readonly matchingEventIds: readonly string[];
  readonly outPointSeconds: number;
}

export interface UpdateClipInput {
  readonly inPointSeconds?: number;
  readonly outPointSeconds?: number;
  readonly title?: string;
}

export function createProjectClip(
  project: PortableProject,
  vodId: string,
  input: CreateClipInput,
  now = new Date(),
): PortableProject {
  const vod = project.vods.find((candidate) => candidate.id === vodId);
  if (vod === undefined) {
    throw new Error('The selected VOD does not exist in this project.');
  }
  validateRange(input.inPointSeconds, input.outPointSeconds, vod.durationSeconds);
  const id = crypto.randomUUID();
  const order = project.clipOrder.length;
  const title =
    vod.searchTerms.length > 0 ? vod.searchTerms.join(' + ') : `Clip ${project.clips.length + 1}`;

  return portableProjectSchema.parse({
    ...project,
    updatedAt: now.toISOString(),
    clips: [
      ...project.clips,
      {
        id,
        vodId,
        title,
        inPointSeconds: input.inPointSeconds,
        outPointSeconds: input.outPointSeconds,
        searchTermsSnapshot: [...vod.searchTerms],
        matchingEventIds: [...input.matchingEventIds],
        order,
        createdAt: now.toISOString(),
        exportStatus: 'notExported',
        lastErrorCode: null,
      },
    ],
    clipOrder: [...project.clipOrder, id],
  });
}

export function updateProjectClip(
  project: PortableProject,
  clipId: string,
  input: UpdateClipInput,
  now = new Date(),
): PortableProject {
  const clip = project.clips.find((candidate) => candidate.id === clipId);
  if (clip === undefined) {
    throw new Error('The selected clip does not exist in this project.');
  }
  const vod = project.vods.find((candidate) => candidate.id === clip.vodId);
  if (vod === undefined) {
    throw new Error('The source VOD does not exist in this project.');
  }
  const inPointSeconds = input.inPointSeconds ?? clip.inPointSeconds;
  const outPointSeconds = input.outPointSeconds ?? clip.outPointSeconds;
  validateRange(inPointSeconds, outPointSeconds, vod.durationSeconds);

  return portableProjectSchema.parse({
    ...project,
    updatedAt: now.toISOString(),
    clips: project.clips.map((candidate) =>
      candidate.id === clipId
        ? {
            ...candidate,
            title: input.title ?? candidate.title,
            inPointSeconds,
            outPointSeconds,
          }
        : candidate,
    ),
  });
}

export function deleteProjectClip(
  project: PortableProject,
  clipId: string,
  now = new Date(),
): PortableProject {
  if (!project.clips.some((clip) => clip.id === clipId)) {
    throw new Error('The selected clip does not exist in this project.');
  }
  const clipOrder = project.clipOrder.filter((id) => id !== clipId);
  const orderById = new Map(clipOrder.map((id, index) => [id, index]));

  return portableProjectSchema.parse({
    ...project,
    updatedAt: now.toISOString(),
    clips: project.clips
      .filter((clip) => clip.id !== clipId)
      .map((clip) => ({ ...clip, order: orderById.get(clip.id) ?? clip.order })),
    clipOrder,
  });
}

export function reorderProjectClips(
  project: PortableProject,
  clipOrder: readonly string[],
  now = new Date(),
): PortableProject {
  if (
    clipOrder.length !== project.clips.length ||
    new Set(clipOrder).size !== clipOrder.length ||
    clipOrder.some((clipId) => !project.clips.some((clip) => clip.id === clipId))
  ) {
    throw new Error('The clip order must contain every project clip exactly once.');
  }
  const orderById = new Map(clipOrder.map((clipId, index) => [clipId, index]));

  return portableProjectSchema.parse({
    ...project,
    updatedAt: now.toISOString(),
    clipOrder: [...clipOrder],
    clips: project.clips.map((clip) => ({ ...clip, order: orderById.get(clip.id) })),
  });
}

export function setClipPanelCollapsed(
  project: PortableProject,
  collapsed: boolean,
  now = new Date(),
): PortableProject {
  return portableProjectSchema.parse({
    ...project,
    updatedAt: now.toISOString(),
    uiState: { ...project.uiState, clipPanelCollapsed: collapsed },
  });
}

function validateRange(inPointSeconds: number, outPointSeconds: number, duration: number | null) {
  if (
    !Number.isFinite(inPointSeconds) ||
    !Number.isFinite(outPointSeconds) ||
    inPointSeconds < 0 ||
    outPointSeconds <= inPointSeconds ||
    (duration !== null && outPointSeconds > duration)
  ) {
    throw new Error('The clip range is outside the source VOD.');
  }
}
