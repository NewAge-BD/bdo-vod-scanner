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
  const recentKillTimes: number[] = [];
  const mappedEvents = events
    .map((event) => ({ event, videoTimeSeconds: mapToVideoTime(event.sessionTimeSeconds) }))
    .filter((entry) => Number.isFinite(entry.videoTimeSeconds))
    .sort((left, right) => left.videoTimeSeconds - right.videoTimeSeconds);

  for (const { event, videoTimeSeconds } of mappedEvents) {
    let killStreakCount = 0;
    let killStreakTier: KillStreakTier | null = null;
    if (includeKillStreaks && event.verb === 'killed') {
      while (
        recentKillTimes[0] !== undefined &&
        videoTimeSeconds - recentKillTimes[0] > KILL_STREAK_WINDOW_SECONDS
      ) {
        recentKillTimes.shift();
      }
      recentKillTimes.push(videoTimeSeconds);
      killStreakCount = recentKillTimes.length;
      killStreakTier = getKillStreakTier(killStreakCount);
    }
    if (videoTimeSeconds < window.startSeconds || videoTimeSeconds > window.endSeconds) {
      continue;
    }
    const positionRatio = (videoTimeSeconds - window.startSeconds) / window.durationSeconds;
    const binIndex = Math.min(binCount - 1, Math.floor(positionRatio * binCount));
    const entries = bins.get(binIndex) ?? [];
    entries.push({ event, killStreakCount, killStreakTier, videoTimeSeconds });
    bins.set(binIndex, entries);
  }

  return [...bins.entries()].map(([binIndex, entries]) => {
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
      representativeEventId: representativeEntry.event.id,
      videoTimeSeconds,
      type: onlyEvent === undefined ? 'bundle' : onlyEvent.verb === 'killed' ? 'kill' : 'death',
    };
  });
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
