export type EventVerb = 'killed' | 'diedTo';

export interface BdoEvent {
  readonly id: string;
  readonly lineNumber: number;
  readonly rawLine: string;
  readonly clockTime: string;
  readonly dayOffset: number;
  readonly sessionTimeSeconds: number;
  readonly verb: EventVerb;
  readonly familyA: string;
  readonly familyB: string;
  readonly guildB: string;
  readonly characterA: string;
  readonly characterB: string;
}

export type LogParseIssueCode = 'invalidLine' | 'outOfOrder';

export interface LogParseIssue {
  readonly code: LogParseIssueCode;
  readonly lineNumber: number;
}

export interface ParsedBdoLog {
  readonly sessionDate: string;
  readonly events: readonly BdoEvent[];
  readonly issues: readonly LogParseIssue[];
}
