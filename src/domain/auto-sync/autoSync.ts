import type { BdoEvent } from '../events';

const DEFAULT_SAMPLE_SPACING_SECONDS = 30;
const DEFAULT_MAX_SAMPLE_COUNT = 120;
const INITIAL_VISIBILITY_LOOKBACK_SECONDS = 5;
const MIN_NAME_SIMILARITY = 0.68;
const MIN_MATCH_CONFIDENCE = 0.62;

export interface AutoSyncRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface AutoSyncMatch {
  readonly confidence: number;
  readonly event: BdoEvent;
  readonly line: string;
}

interface RecognitionCandidate {
  readonly line: string;
  readonly lineIndex: number;
  readonly scoringText: string;
}

export function buildCenteredSampleTimes(
  durationSeconds: number,
  centerSeconds: number,
  spacingSeconds = DEFAULT_SAMPLE_SPACING_SECONDS,
  maximumCount = DEFAULT_MAX_SAMPLE_COUNT,
): readonly number[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || maximumCount <= 0) {
    return [];
  }

  const duration = Math.max(0, durationSeconds);
  const spacing = Math.max(1, spacingSeconds);
  const center = clamp(centerSeconds, 0, duration);
  const samples: number[] = [center];
  const seen = new Set([center.toFixed(3)]);

  for (let distance = spacing; samples.length < maximumCount; distance += spacing) {
    let added = false;
    for (const candidate of [center + distance, center - distance]) {
      const time = clamp(candidate, 0, duration);
      const key = time.toFixed(3);
      if (!seen.has(key)) {
        seen.add(key);
        samples.push(time);
        added = true;
      }
      if (samples.length >= maximumCount) {
        break;
      }
    }
    if (!added && center + distance >= duration && center - distance <= 0) {
      break;
    }
  }

  return samples;
}

export function buildBackwardVisibilityProbeTimes(
  initialVisibleTimeSeconds: number,
): readonly number[] {
  if (!Number.isFinite(initialVisibleTimeSeconds)) {
    return [];
  }

  const initialTime = Math.max(0, initialVisibleTimeSeconds);
  if (initialTime === 0) {
    return [];
  }

  const times: number[] = [];
  let lookback = INITIAL_VISIBILITY_LOOKBACK_SECONDS;
  while (lookback < initialTime) {
    times.push(initialTime - lookback);
    lookback *= 2;
  }
  times.push(0);
  return times;
}

export function findBestAutoSyncMatch(
  recognizedText: string,
  events: readonly BdoEvent[],
): AutoSyncMatch | undefined {
  const candidatesWithContext = buildRecognitionCandidates(recognizedText);
  const candidates: Array<AutoSyncMatch & { readonly lineIndex: number }> = [];

  for (const { line, lineIndex, scoringText } of candidatesWithContext) {
    for (const event of events) {
      if (event.verb !== 'killed') {
        continue;
      }
      const confidence = scoreLineForEvent(scoringText, event);
      if (confidence >= MIN_MATCH_CONFIDENCE) {
        candidates.push({ confidence, event, line, lineIndex });
      }
    }
  }

  candidates.sort(
    (left, right) => right.lineIndex - left.lineIndex || right.confidence - left.confidence,
  );
  const best = candidates[0];
  return best === undefined
    ? undefined
    : { confidence: best.confidence, event: best.event, line: best.line };
}

export function isAutoSyncEventVisible(recognizedText: string, event: BdoEvent): boolean {
  return buildRecognitionCandidates(recognizedText).some(
    ({ scoringText }) => scoreLineForEvent(scoringText, event) >= MIN_MATCH_CONFIDENCE,
  );
}

function scoreLineForEvent(line: string, event: BdoEvent): number {
  const normalizedLine = normalizeText(line);
  const tokens = normalizedLine.split(' ').filter((token) => token.length > 0);
  const attacker = bestNameSimilarity(tokens, normalizedLine, [event.familyA, event.characterA]);
  const victim = bestNameSimilarity(tokens, normalizedLine, [event.familyB, event.characterB]);

  if (
    attacker < MIN_NAME_SIMILARITY ||
    victim < MIN_NAME_SIMILARITY ||
    !hasMatchingVisibleMinute(line, event.clockTime)
  ) {
    return 0;
  }

  const guild = bestNameSimilarity(tokens, normalizedLine, [event.guildB]);
  const verb = approximateTokenSimilarity(tokens, 'killed');
  return attacker * 0.36 + victim * 0.36 + guild * 0.14 + verb * 0.14;
}

function buildRecognitionCandidates(recognizedText: string): readonly RecognitionCandidate[] {
  const lines = recognizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line, lineIndex) => {
    const nextLine = lines[lineIndex + 1];
    return {
      line,
      lineIndex,
      scoringText:
        nextLine !== undefined && isStandaloneChatTimestamp(nextLine)
          ? `${line} ${nextLine}`
          : line,
    };
  });
}

function hasMatchingVisibleMinute(line: string, clockTime: string): boolean {
  const expectedHour = Number(clockTime.slice(0, 2));
  const expectedMinute = Number(clockTime.slice(3, 5));
  if (!Number.isInteger(expectedHour) || !Number.isInteger(expectedMinute)) {
    return false;
  }

  return Array.from(line.matchAll(/(?:^|\D)([0-2]?\d)\D{0,3}([0-5]\d)(?=\D|$)/g)).some(
    (match) => Number(match[1]) === expectedHour && Number(match[2]) === expectedMinute,
  );
}

function isStandaloneChatTimestamp(line: string): boolean {
  return /^\W*[0-2]?\d\D{0,3}[0-5]\d\W*$/.test(line);
}

function bestNameSimilarity(
  tokens: readonly string[],
  normalizedLine: string,
  names: readonly string[],
): number {
  return Math.max(
    ...names.map((name) => {
      const normalizedName = normalizeText(name).replaceAll(' ', '');
      if (normalizedName.length === 0) {
        return 0;
      }
      if (normalizedLine.replaceAll(' ', '').includes(normalizedName)) {
        return 1;
      }
      return approximateTokenSimilarity(tokens, normalizedName);
    }),
  );
}

function approximateTokenSimilarity(tokens: readonly string[], expected: string): number {
  if (expected.length === 0 || tokens.length === 0) {
    return 0;
  }
  return Math.max(...tokens.map((token) => similarity(token, expected)));
}

function similarity(left: string, right: string): number {
  const maximumLength = Math.max(left.length, right.length);
  if (maximumLength === 0) {
    return 1;
  }
  return 1 - levenshteinDistance(left, right) / maximumLength;
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0]!;
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex]!;
      previous[rightIndex] = Math.min(
        previous[rightIndex]! + 1,
        previous[rightIndex - 1]! + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length]!;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
