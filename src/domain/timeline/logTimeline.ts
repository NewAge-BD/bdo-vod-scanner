import type { EventVerb } from '../events';
import type { TimelineWindow } from './videoTimeline';

export interface TimelineLogEvent {
  readonly id: string;
  readonly sessionTimeSeconds: number;
  readonly verb: EventVerb;
}

export type KillStreakTier = 'challenger' | 'invader' | 'slayer' | 'conqueror';

export interface LogTimelineMarker {
  readonly id: string;
  readonly eventIds: readonly string[];
  readonly eventCount: number;
  readonly killCount: number;
  readonly killStreakCount: number;
  readonly killStreakTier: KillStreakTier | null;
  readonly positionRatio: number;
  readonly rangeEndPositionRatio: number | null;
  readonly rangeStartPositionRatio: number | null;
  readonly representativeEventId: string;
  readonly videoTimeSeconds: number;
  readonly type: 'kill' | 'death' | 'bundle';
}

const KILL_STREAK_WINDOW_SECONDS = 15;

interface AnnotatedTimelineEntry {
  readonly event: TimelineLogEvent;
  readonly killStreakCount: number;
  readonly killStreakTier: KillStreakTier | null;
  readonly videoTimeSeconds: number;
}

interface MappedTimelineEntry {
  readonly event: TimelineLogEvent;
  readonly videoTimeSeconds: number;
}

interface KillStreakSummary {
  readonly entries: readonly MappedTimelineEntry[];
  readonly endVideoTimeSeconds: number;
  readonly startVideoTimeSeconds: number;
  readonly tier: KillStreakTier;
}

export function buildLogTimelineMarkers(
  events: readonly TimelineLogEvent[],
  mapToVideoTime: (sessionTimeSeconds: number) => number,
  window: TimelineWindow,
  maximumMarkers = 48,
  includeKillStreaks = false,
): readonly LogTimelineMarker[] {
  if (window.durationSeconds <= 0 || maximumMarkers <= 0) {
    return [];
  }

  const binCount = Math.max(1, Math.floor(maximumMarkers));
  const bins = new Map<number, AnnotatedTimelineEntry[]>();
  const mappedEvents = events
    .map((event) => ({ event, videoTimeSeconds: mapToVideoTime(event.sessionTimeSeconds) }))
    .filter((entry) => Number.isFinite(entry.videoTimeSeconds))
    .sort((left, right) => left.videoTimeSeconds - right.videoTimeSeconds);
  const killStreaks = includeKillStreaks ? buildKillStreakSummaries(mappedEvents) : [];
  const summarizedEventIds = new Set(
    killStreaks.flatMap((summary) => summary.entries.map((entry) => entry.event.id)),
  );

  for (const { event, videoTimeSeconds } of mappedEvents) {
    if (summarizedEventIds.has(event.id)) {
      continue;
    }
    if (videoTimeSeconds < window.startSeconds || videoTimeSeconds > window.endSeconds) {
      continue;
    }
    const positionRatio = (videoTimeSeconds - window.startSeconds) / window.durationSeconds;
    const binIndex = Math.min(binCount - 1, Math.floor(positionRatio * binCount));
    const entries = bins.get(binIndex) ?? [];
    entries.push({ event, killStreakCount: 0, killStreakTier: null, videoTimeSeconds });
    bins.set(binIndex, entries);
  }

  const ordinaryMarkers = [...bins.entries()].map<LogTimelineMarker>(([binIndex, entries]) => {
    const averageVideoTimeSeconds =
      entries.reduce((sum, entry) => sum + entry.videoTimeSeconds, 0) / entries.length;
    const highestStreakEntry = entries.reduce<AnnotatedTimelineEntry | undefined>(
      (highest, entry) =>
        entry.killStreakTier !== null && entry.killStreakCount > (highest?.killStreakCount ?? 0)
          ? entry
          : highest,
      undefined,
    );
    const representativeEntry =
      highestStreakEntry ??
      entries.reduce((closest, entry) =>
        Math.abs(entry.videoTimeSeconds - averageVideoTimeSeconds) <
        Math.abs(closest.videoTimeSeconds - averageVideoTimeSeconds)
          ? entry
          : closest,
      );
    const videoTimeSeconds = representativeEntry.videoTimeSeconds;
    const onlyEvent = entries.length === 1 ? entries[0]?.event : undefined;
    const killCount = entries.filter((entry) => entry.event.verb === 'killed').length;
    return {
      id: `log-marker-${binIndex}-${entries[0]?.event.id ?? 'empty'}`,
      eventIds: entries.map((entry) => entry.event.id),
      eventCount: entries.length,
      killCount,
      killStreakCount: representativeEntry.killStreakCount,
      killStreakTier: representativeEntry.killStreakTier,
      positionRatio: Math.min(
        1,
        Math.max(0, (videoTimeSeconds - window.startSeconds) / window.durationSeconds),
      ),
      rangeEndPositionRatio: null,
      rangeStartPositionRatio: null,
      representativeEventId: representativeEntry.event.id,
      videoTimeSeconds,
      type: onlyEvent === undefined ? 'bundle' : onlyEvent.verb === 'killed' ? 'kill' : 'death',
    };
  });

  const streakMarkers = killStreaks
    .filter(
      (summary) =>
        summary.endVideoTimeSeconds >= window.startSeconds &&
        summary.startVideoTimeSeconds <= window.endSeconds,
    )
    .map((summary) => {
      const firstEntry = summary.entries[0]!;
      const representativeEntry = summary.entries.at(-1)!;
      const startPositionRatio = clampRatio(
        (summary.startVideoTimeSeconds - window.startSeconds) / window.durationSeconds,
      );
      const endPositionRatio = clampRatio(
        (summary.endVideoTimeSeconds - window.startSeconds) / window.durationSeconds,
      );
      return {
        id: `kill-streak-${firstEntry.event.id}-${representativeEntry.event.id}`,
        eventIds: summary.entries.map((entry) => entry.event.id),
        eventCount: summary.entries.length,
        killCount: summary.entries.length,
        killStreakCount: summary.entries.length,
        killStreakTier: summary.tier,
        positionRatio: (startPositionRatio + endPositionRatio) / 2,
        rangeEndPositionRatio: endPositionRatio,
        rangeStartPositionRatio: startPositionRatio,
        representativeEventId: representativeEntry.event.id,
        videoTimeSeconds: representativeEntry.videoTimeSeconds,
        type: 'bundle' as const,
      };
    });

  return [...ordinaryMarkers, ...streakMarkers].sort(
    (left, right) => left.positionRatio - right.positionRatio,
  );
}

function buildKillStreakSummaries(
  entries: readonly MappedTimelineEntry[],
): readonly KillStreakSummary[] {
  const kills = entries.filter((entry) => entry.event.verb === 'killed');
  const summaries: KillStreakSummary[] = [];
  let startIndex = 0;

  while (startIndex < kills.length) {
    const startEntry = kills[startIndex]!;
    let endIndex = startIndex + 1;
    while (
      endIndex < kills.length &&
      kills[endIndex]!.videoTimeSeconds - startEntry.videoTimeSeconds <= KILL_STREAK_WINDOW_SECONDS
    ) {
      endIndex += 1;
    }
    const streakEntries = kills.slice(startIndex, endIndex);
    const tier = getKillStreakTier(streakEntries.length);
    if (tier !== null) {
      summaries.push({
        entries: streakEntries,
        endVideoTimeSeconds: streakEntries.at(-1)!.videoTimeSeconds,
        startVideoTimeSeconds: startEntry.videoTimeSeconds,
        tier,
      });
      startIndex = endIndex;
    } else {
      startIndex += 1;
    }
  }

  return summaries;
}

function clampRatio(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function getKillStreakTier(killCount: number): KillStreakTier | null {
  if (killCount >= 5) {
    return 'conqueror';
  }
  if (killCount === 4) {
    return 'slayer';
  }
  if (killCount === 3) {
    return 'invader';
  }
  return killCount === 2 ? 'challenger' : null;
}
