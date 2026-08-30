import type { BdoEvent } from './types';

export function searchEvents(
  events: readonly BdoEvent[],
  searchTerms: readonly string[],
): readonly BdoEvent[] {
  const normalizedTerms = searchTerms.map(normalize).filter((term) => term.length > 0);

  if (normalizedTerms.length === 0) {
    return events;
  }

  return events.filter((event) => eventMatchesNormalizedTerms(event, normalizedTerms));
}

export function eventMatchesAnyTerm(event: BdoEvent, searchTerms: readonly string[]): boolean {
  const normalizedTerms = searchTerms.map(normalize).filter((term) => term.length > 0);

  return eventMatchesNormalizedTerms(event, normalizedTerms);
}

function eventMatchesNormalizedTerms(event: BdoEvent, normalizedTerms: readonly string[]): boolean {
  const searchableFields = [
    event.familyA,
    event.familyB,
    event.guildB,
    event.characterA,
    event.characterB,
  ].map(normalize);

  return normalizedTerms.some((term) => searchableFields.some((field) => field.includes(term)));
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}
