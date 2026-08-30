import type { EventVerb } from '../events';
import type { TimelineWindow } from './videoTimeline';

export interface TimelineLogEvent {
  readonly id: string;
  readonly sessionTimeSeconds: number;
  readonly verb: EventVerb;
}

export interface LogTimelineMarker {
  readonly id: string;
  readonly eventIds: readonly string[];
  readonly eventCount: number;
  readonly killCount: number;
  readonly positionRatio: number;
  readonly representativeEventId: string;
  readonly videoTimeSeconds: number;
  readonly type: 'kill' | 'death' | 'bundle' | 'killBurst';
}

const KILL_BURST_MINIMUM_KILLS = 5;
const KILL_BURST_WINDOW_SECONDS = 10;

export function buildLogTimelineMarkers(
  events: readonly TimelineLogEvent[],
  mapToVideoTime: (sessionTimeSeconds: number) => number,
  window: TimelineWindow,
  maximumMarkers = 48,
): readonly LogTimelineMarker[] {
  if (window.durationSeconds <= 0 || maximumMarkers <= 0) {
    return [];
  }

  const binCount = Math.max(1, Math.floor(maximumMarkers));
  const bins = new Map<number, Array<{ event: TimelineLogEvent; videoTimeSeconds: number }>>();

  for (const event of events) {
    const videoTimeSeconds = mapToVideoTime(event.sessionTimeSeconds);
    if (
      !Number.isFinite(videoTimeSeconds) ||
      videoTimeSeconds < window.startSeconds ||
      videoTimeSeconds > window.endSeconds
    ) {
      continue;
    }
    const positionRatio = (videoTimeSeconds - window.startSeconds) / window.durationSeconds;
    const binIndex = Math.min(binCount - 1, Math.floor(positionRatio * binCount));
    const entries = bins.get(binIndex) ?? [];
    entries.push({ event, videoTimeSeconds });
    bins.set(binIndex, entries);
  }

  return [...bins.entries()].map(([binIndex, entries]) => {
    const averageVideoTimeSeconds =
      entries.reduce((sum, entry) => sum + entry.videoTimeSeconds, 0) / entries.length;
    const representativeEntry = entries.reduce((closest, entry) =>
      Math.abs(entry.videoTimeSeconds - averageVideoTimeSeconds) <
      Math.abs(closest.videoTimeSeconds - averageVideoTimeSeconds)
        ? entry
        : closest,
    );
    const videoTimeSeconds = representativeEntry.videoTimeSeconds;
    const onlyEvent = entries.length === 1 ? entries[0]?.event : undefined;
    const killEntries = entries
      .filter((entry) => entry.event.verb === 'killed')
      .sort((left, right) => left.videoTimeSeconds - right.videoTimeSeconds);
    const killCount = killEntries.length;
    const killBurst = killEntries.some((entry, index) => {
      const lastEntry = killEntries[index + KILL_BURST_MINIMUM_KILLS - 1];
      return (
        lastEntry !== undefined &&
        lastEntry.videoTimeSeconds - entry.videoTimeSeconds <= KILL_BURST_WINDOW_SECONDS
      );
    });
    return {
      id: `log-marker-${binIndex}-${entries[0]?.event.id ?? 'empty'}`,
      eventIds: entries.map((entry) => entry.event.id),
      eventCount: entries.length,
      killCount,
      positionRatio: Math.min(
        1,
        Math.max(0, (videoTimeSeconds - window.startSeconds) / window.durationSeconds),
      ),
      representativeEventId: representativeEntry.event.id,
      videoTimeSeconds,
      type:
        onlyEvent !== undefined
          ? onlyEvent.verb === 'killed'
            ? 'kill'
            : 'death'
          : killBurst
            ? 'killBurst'
            : 'bundle',
    };
  });
}
