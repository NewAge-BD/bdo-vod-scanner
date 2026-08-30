import { InvalidLogFileNameError, UnrecognizedLogError } from './errors';
import type { BdoEvent, EventVerb, LogParseIssue, ParsedBdoLog } from './types';

const LOG_FILE_NAME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})\.log$/;
const EVENT_LINE_PATTERN =
  /^\[(\d{2}):(\d{2}):(\d{2})\] (.+?) (killed|died to) (.+?) from (.+?) \((.+?), (.+?)\)$/;
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

export function parseBdoLog(fileName: string, rawLog: string): ParsedBdoLog {
  const sessionDate = parseSessionDate(fileName);
  const events: BdoEvent[] = [];
  const issues: LogParseIssue[] = [];
  const lines = rawLog.split(/\r?\n/);

  let dayOffset = 0;
  let previousClockSeconds: number | undefined;

  for (const [lineIndex, originalLine] of lines.entries()) {
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
      rawLine: originalLine,
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

function parseSessionDate(fileName: string): string {
  const match = LOG_FILE_NAME_PATTERN.exec(fileName);

  if (match === null) {
    throw new InvalidLogFileNameError(fileName);
  }

  const [, yearText, monthText, dayText] = match;
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
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);

  if (hour > 23 || minute > 59 || second > 59) {
    return undefined;
  }

  const fields = [familyA, familyB, guildB, characterA, characterB];
  if (fields.some((field) => field === undefined || field.trim().length === 0)) {
    return undefined;
  }

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

  return {
    clockTime: `${hourText}:${minuteText}:${secondText}`,
    clockSeconds: hour * 3600 + minute * 60 + second,
    verb: verbText === 'killed' ? 'killed' : 'diedTo',
    familyA: familyA.trim(),
    familyB: familyB.trim(),
    guildB: guildB.trim(),
    characterA: characterA.trim(),
    characterB: characterB.trim(),
  };
}
