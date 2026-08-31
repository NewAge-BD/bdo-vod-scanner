import { describe, expect, it } from 'vitest';

import type { BdoEvent } from '../events';
import {
  buildCenteredSampleTimes,
  findBestAutoSyncMatch,
  isAutoSyncEventVisible,
} from './autoSync';

const events: readonly BdoEvent[] = [
  {
    id: 'match',
    lineNumber: 1,
    rawLine: '',
    clockTime: '20:26:19',
    dayOffset: 0,
    sessionTimeSeconds: 73_579,
    verb: 'killed',
    familyA: 'StoneFamily',
    familyB: 'EmberFamily',
    guildB: 'MoonGuard',
    characterA: 'StoneRaven',
    characterB: 'EmberWarden',
  },
  {
    id: 'other',
    lineNumber: 2,
    rawLine: '',
    clockTime: '20:28:04',
    dayOffset: 0,
    sessionTimeSeconds: 73_684,
    verb: 'killed',
    familyA: 'SomeoneElse',
    familyB: 'DifferentTarget',
    guildB: 'OTHER',
    characterA: 'Unrelated',
    characterB: 'Opponent',
  },
];

describe('automatic synchronization matching', () => {
  it('samples outward from the current video position without duplicates', () => {
    expect(buildCenteredSampleTimes(100, 50, 30, 5)).toEqual([50, 80, 20, 100, 0]);
  });

  it('matches a BDO chat kill line against character names, guild, and minute', () => {
    const match = findBestAutoSyncMatch(
      '[StoneRaven] killed [EmberWarden] of the [MoonGuard] alliance. (20:26)',
      events,
    );

    expect(match?.event.id).toBe('match');
    expect(match?.confidence).toBeGreaterThan(0.9);
  });

  it('tolerates small OCR errors but rejects unrelated text', () => {
    expect(
      isAutoSyncEventVisible(
        '[StoneRavcn] kiIled [EmberVVarden] of the [M00nGuard] alliance. (20:26)',
        events[0]!,
      ),
    ).toBe(true);
    expect(findBestAutoSyncMatch('System: Guild mission completed.', events)).toBeUndefined();
  });
});
