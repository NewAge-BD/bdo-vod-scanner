import { InvalidLogFileNameError, UnrecognizedLogError } from './errors';
import type { BdoEvent, EventVerb, LogParseIssue, ParsedBdoLog } from './types';

const ISO_DATE_PATTERN = /(?:^|\D)(\d{4})-(\d{2})-(\d{2})(?=\D|$)/;
const EUROPEAN_DATE_PATTERN = /(?:^|\D)(\d{2})\.(\d{2})\.(\d{4})(?=\D|$)/;
const EVENT_LINE_PATTERN =
  /^\[(\d{2}):(\d{2}):(\d{2})\] (.+?) (killed|has killed|died to) (.+?) from (.+?) \((.+?),\s*(.+?)\)$/;
const IKUSA_FORMAT = 'ikusa-raw-session';
const IKUSA_VERSION = 4;
const SECONDS_PER_DAY = 86_400;
const MIDNIGHT_ROLLOVER_THRESHOLD_SECONDS = 12 * 60 * 60;

interface ParsedEventLine {
  readonly clockTime: string;
  readonly clockSeconds: number;
  readonly verb: EventVerb;
  readonly familyA: string;
  readonly familyB: string;
  readonly guildB: string;
  readonly characterA: string;
  readonly characterB: string;
}

interface IndexedParsedLine {
  readonly lineNumber: number;
  readonly parsedLine: ParsedEventLine;
  readonly rawLine: string;
}

export function parseBdoLog(fileName: string, rawLog: string): ParsedBdoLog {
  if (rawLog.trimStart().startsWith('{')) {
    return parseIkusaLog(fileName, rawLog);
  }

  const sessionDate = parseSessionDate(fileName);
  const issues: LogParseIssue[] = [];
  const parsedLines: IndexedParsedLine[] = [];
  for (const [lineIndex, originalLine] of rawLog.split(/\r?\n/).entries()) {
    const lineNumber = lineIndex + 1;
    const line = lineIndex === 0 ? originalLine.replace(/^\uFEFF/, '') : originalLine;
    if (line.trim().length === 0) {
      continue;
    }
    const parsedLine = parseEventLine(line);
    if (parsedLine === undefined) {
      issues.push({ code: 'invalidLine', lineNumber });
      continue;
    }
    parsedLines.push({ lineNumber, parsedLine, rawLine: originalLine });
  }
  return buildParsedLog(sessionDate, parsedLines, issues);
}

function parseIkusaLog(fileName: string, rawLog: string): ParsedBdoLog {
  let value: unknown;
  try {
    value = JSON.parse(rawLog) as unknown;
  } catch {
    throw new UnrecognizedLogError();
  }
  if (!isRecord(value) || value.format !== IKUSA_FORMAT || value.version !== IKUSA_VERSION) {
    throw new UnrecognizedLogError();
  }
  const sessionDate = parseSessionDate(
    fileName,
    typeof value.saved_at === 'string' ? value.saved_at.slice(0, 10) : undefined,
  );
  if (!Array.isArray(value.logs)) {
    throw new UnrecognizedLogError();
  }

  const issues: LogParseIssue[] = [];
  const parsedLines: IndexedParsedLine[] = [];
  for (const [entryIndex, entry] of value.logs.entries()) {
    const lineNumber = entryIndex + 1;
    const parsedLine = parseIkusaEntry(entry);
    if (parsedLine === undefined) {
      issues.push({ code: 'invalidLine', lineNumber });
      continue;
    }
    parsedLines.push({ lineNumber, parsedLine, rawLine: formatCanonicalEventLine(parsedLine) });
  }
  return buildParsedLog(sessionDate, parsedLines, issues);
}

function buildParsedLog(
  sessionDate: string,
  parsedLines: readonly IndexedParsedLine[],
  initialIssues: readonly LogParseIssue[],
): ParsedBdoLog {
  const events: BdoEvent[] = [];
  const issues = [...initialIssues];
  let dayOffset = 0;
  let previousClockSeconds: number | undefined;
  for (const { lineNumber, parsedLine, rawLine } of parsedLines) {
    if (previousClockSeconds !== undefined && parsedLine.clockSeconds < previousClockSeconds) {
      const backwardsJump = previousClockSeconds - parsedLine.clockSeconds;
      if (backwardsJump > MIDNIGHT_ROLLOVER_THRESHOLD_SECONDS) {
        dayOffset += 1;
      } else {
        issues.push({ code: 'outOfOrder', lineNumber });
      }
    }
    events.push({
      id: `${sessionDate}:${lineNumber}`,
      lineNumber,
      rawLine,
      clockTime: parsedLine.clockTime,
      dayOffset,
      sessionTimeSeconds: dayOffset * SECONDS_PER_DAY + parsedLine.clockSeconds,
      verb: parsedLine.verb,
      familyA: parsedLine.familyA,
      familyB: parsedLine.familyB,
      guildB: parsedLine.guildB,
      characterA: parsedLine.characterA,
      characterB: parsedLine.characterB,
    });
    previousClockSeconds = parsedLine.clockSeconds;
  }
  if (events.length === 0) {
    throw new UnrecognizedLogError();
  }
  return { sessionDate, events, issues };
}

function parseSessionDate(fileName: string, fallbackDate?: string): string {
  const isoMatch = ISO_DATE_PATTERN.exec(fileName) ?? ISO_DATE_PATTERN.exec(fallbackDate ?? '');
  if (isoMatch !== null) {
    return validateDate(isoMatch[1], isoMatch[2], isoMatch[3], fileName);
  }
  const europeanMatch = EUROPEAN_DATE_PATTERN.exec(fileName);
  if (europeanMatch !== null) {
    return validateDate(europeanMatch[3], europeanMatch[2], europeanMatch[1], fileName);
  }
  throw new InvalidLogFileNameError(fileName);
}

function validateDate(
  yearText: string | undefined,
  monthText: string | undefined,
  dayText: string | undefined,
  fileName: string,
): string {
  if (yearText === undefined || monthText === undefined || dayText === undefined) {
    throw new InvalidLogFileNameError(fileName);
  }
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new InvalidLogFileNameError(fileName);
  }
  return `${yearText}-${monthText}-${dayText}`;
}

function parseEventLine(line: string): ParsedEventLine | undefined {
  const match = EVENT_LINE_PATTERN.exec(line);
  if (match === null) {
    return undefined;
  }
  const [
    ,
    hourText,
    minuteText,
    secondText,
    familyA,
    verbText,
    familyB,
    guildB,
    characterB,
    characterA,
  ] = match;
  return createParsedEventLine({
    hourText,
    minuteText,
    secondText,
    familyA,
    familyB,
    guildB,
    characterA,
    characterB,
    verb: verbText === 'died to' ? 'diedTo' : 'killed',
  });
}

function parseIkusaEntry(value: unknown): ParsedEventLine | undefined {
  if (!isRecord(value) || typeof value.time !== 'string' || typeof value.isKill !== 'boolean') {
    return undefined;
  }
  const timeMatch = /^(\d{2}):(\d{2}):(\d{2})$/.exec(value.time);
  if (timeMatch === null || !Array.isArray(value.names) || value.names.length !== 5) {
    return undefined;
  }
  const names = value.names;
  if (!names.every((name): name is string => typeof name === 'string')) {
    return undefined;
  }
  return createParsedEventLine({
    hourText: timeMatch[1],
    minuteText: timeMatch[2],
    secondText: timeMatch[3],
    characterB: names[0],
    guildB: names[1],
    characterA: names[2],
    familyA: names[3],
    familyB: names[4],
    verb: value.isKill ? 'killed' : 'diedTo',
  });
}

function createParsedEventLine({
  hourText,
  minuteText,
  secondText,
  verb,
  familyA,
  familyB,
  guildB,
  characterA,
  characterB,
}: {
  readonly hourText: string | undefined;
  readonly minuteText: string | undefined;
  readonly secondText: string | undefined;
  readonly verb: EventVerb;
  readonly familyA: string | undefined;
  readonly familyB: string | undefined;
  readonly guildB: string | undefined;
  readonly characterA: string | undefined;
  readonly characterB: string | undefined;
}): ParsedEventLine | undefined {
  if (
    hourText === undefined ||
    minuteText === undefined ||
    secondText === undefined ||
    familyA === undefined ||
    familyB === undefined ||
    guildB === undefined ||
    characterA === undefined ||
    characterB === undefined
  ) {
    return undefined;
  }
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const fields = [familyA, familyB, guildB, characterA, characterB];
  if (
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    fields.some((field) => field.trim().length === 0)
  ) {
    return undefined;
  }
  return {
    clockTime: `${hourText}:${minuteText}:${secondText}`,
    clockSeconds: hour * 3600 + minute * 60 + second,
    verb,
    familyA: familyA.trim(),
    familyB: familyB.trim(),
    guildB: guildB.trim(),
    characterA: characterA.trim(),
    characterB: characterB.trim(),
  };
}

function formatCanonicalEventLine(event: ParsedEventLine): string {
  const verb = event.verb === 'killed' ? 'killed' : 'died to';
  return `[${event.clockTime}] ${event.familyA} ${verb} ${event.familyB} from ${event.guildB} (${event.characterB}, ${event.characterA})`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
