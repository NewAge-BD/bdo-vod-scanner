import { describe, expect, it } from 'vitest';

import { parseBdoLog } from './parseBdoLog';
import { eventMatchesAnyTerm, searchEvents } from './searchEvents';

const { events } = parseBdoLog(
  '2026-08-29.log',
  [
    '[20:00:56] EmberVale killed NightHarbor from MoonGuard (ShadeLance, SolarBloom)',
    '[20:00:59] FrostCairn died to RiverWarden from DawnKeep (TideCaller, IcePetal)',
    '[20:01:39] CopperGrove killed MistRunner from StarFoundry (CloudStep, BronzeLeaf)',
  ].join('\n'),
);

describe('searchEvents', () => {
  it.each([
    ['family A', 'ember', 'EmberVale'],
    ['family B', 'harbor', 'EmberVale'],
    ['guild B', 'moon', 'EmberVale'],
    ['character A', 'solar', 'EmberVale'],
    ['character B', 'shade', 'EmberVale'],
  ])('matches partial text in %s', (_field, term, expectedFamily) => {
    expect(searchEvents(events, [term]).map((event) => event.familyA)).toEqual([expectedFamily]);
  });

  it('ignores case and whitespace', () => {
    expect(searchEvents(events, ['  DAWNKEEP ']).map((event) => event.familyA)).toEqual([
      'FrostCairn',
    ]);
  });

  it('uses OR semantics for multiple names', () => {
    expect(searchEvents(events, ['solar', 'bronze']).map((event) => event.familyA)).toEqual([
      'EmberVale',
      'CopperGrove',
    ]);
  });

  it('returns every event for an empty search', () => {
    expect(searchEvents(events, ['', '   '])).toBe(events);
  });

  it('normalizes terms for a single-event check', () => {
    expect(eventMatchesAnyTerm(events[0]!, [' MOON '])).toBe(true);
    expect(eventMatchesAnyTerm(events[0]!, ['river'])).toBe(false);
  });
});
