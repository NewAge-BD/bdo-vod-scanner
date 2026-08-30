import { describe, expect, it } from 'vitest';

import syntheticLog from '../../test/fixtures/2026-08-29.log?raw';
import { InvalidLogFileNameError, UnrecognizedLogError } from './errors';
import { parseBdoLog } from './parseBdoLog';

describe('parseBdoLog', () => {
  it('parses the committed synthetic fixture across midnight', () => {
    const result = parseBdoLog('2026-08-29.log', syntheticLog);

    expect(result.events).toHaveLength(3);
    expect(result.events[2]).toEqual(expect.objectContaining({ dayOffset: 1 }));
    expect(result.issues).toEqual([]);
  });

  it('maps killed-event family, guild, and character semantics', () => {
    const result = parseBdoLog(
      '2026-08-29.log',
      '[20:01:39] EmberVale killed NightHarbor from MoonGuard (ShadeLance, SolarBloom)',
    );

    expect(result.sessionDate).toBe('2026-08-29');
    expect(result.events).toEqual([
      expect.objectContaining({
        id: '2026-08-29:1',
        lineNumber: 1,
        clockTime: '20:01:39',
        dayOffset: 0,
        verb: 'killed',
        familyA: 'EmberVale',
        familyB: 'NightHarbor',
        guildB: 'MoonGuard',
        characterA: 'SolarBloom',
        characterB: 'ShadeLance',
      }),
    ]);
    expect(result.issues).toEqual([]);
  });

  it('maps died-to events without reversing their participants', () => {
    const result = parseBdoLog(
      '2026-08-29.log',
      '[20:00:56] FrostCairn died to RiverWarden from DawnKeep (TideCaller, IcePetal)',
    );

    expect(result.events[0]).toEqual(
      expect.objectContaining({
        verb: 'diedTo',
        familyA: 'FrostCairn',
        familyB: 'RiverWarden',
        guildB: 'DawnKeep',
        characterA: 'IcePetal',
        characterB: 'TideCaller',
      }),
    );
  });

  it('keeps events with the same timestamp distinct', () => {
    const result = parseBdoLog(
      '2026-08-29.log',
      [
        '[20:04:52] EmberVale killed NightHarbor from MoonGuard (ShadeLance, SolarBloom)',
        '[20:04:52] CopperGrove killed MistRunner from StarFoundry (CloudStep, BronzeLeaf)',
      ].join('\n'),
    );

    expect(result.events).toHaveLength(2);
    expect(result.events[0]?.sessionTimeSeconds).toBe(result.events[1]?.sessionTimeSeconds);
    expect(result.events[0]?.id).not.toBe(result.events[1]?.id);
  });

  it('increments the day after a clear midnight rollover', () => {
    const result = parseBdoLog(
      '2026-08-29.log',
      [
        '[23:59:58] EmberVale killed NightHarbor from MoonGuard (ShadeLance, SolarBloom)',
        '[00:00:03] CopperGrove killed MistRunner from StarFoundry (CloudStep, BronzeLeaf)',
      ].join('\n'),
    );

    expect(result.events[0]).toEqual(expect.objectContaining({ dayOffset: 0 }));
    expect(result.events[1]).toEqual(
      expect.objectContaining({ dayOffset: 1, sessionTimeSeconds: 86_403 }),
    );
    expect(result.issues).toEqual([]);
  });

  it('keeps valid events and reports isolated malformed lines', () => {
    const result = parseBdoLog(
      '2026-08-29.log',
      [
        '[20:00:56] EmberVale killed NightHarbor from MoonGuard (ShadeLance, SolarBloom)',
        'not an event',
        '[20:01:00] CopperGrove killed MistRunner from StarFoundry (CloudStep, BronzeLeaf)',
      ].join('\n'),
    );

    expect(result.events).toHaveLength(2);
    expect(result.events.map((event) => event.lineNumber)).toEqual([1, 3]);
    expect(result.issues).toEqual([{ code: 'invalidLine', lineNumber: 2 }]);
  });

  it('warns about a small backwards jump instead of treating it as midnight', () => {
    const result = parseBdoLog(
      '2026-08-29.log',
      [
        '[20:01:00] EmberVale killed NightHarbor from MoonGuard (ShadeLance, SolarBloom)',
        '[20:00:59] CopperGrove killed MistRunner from StarFoundry (CloudStep, BronzeLeaf)',
      ].join('\n'),
    );

    expect(result.events[1]?.dayOffset).toBe(0);
    expect(result.issues).toEqual([{ code: 'outOfOrder', lineNumber: 2 }]);
  });

  it('ignores empty lines and accepts a UTF-8 byte-order mark', () => {
    const result = parseBdoLog(
      '2026-08-29.log',
      '\uFEFF[20:00:56] EmberVale killed NightHarbor from MoonGuard (ShadeLance, SolarBloom)\n\n',
    );

    expect(result.events).toHaveLength(1);
    expect(result.issues).toEqual([]);
  });

  it.each(['session.log', '2026-02-30.log', '2026-8-29.log'])(
    'rejects invalid log filename %s',
    (fileName) => {
      expect(() =>
        parseBdoLog(
          fileName,
          '[20:00:56] EmberVale killed NightHarbor from MoonGuard (ShadeLance, SolarBloom)',
        ),
      ).toThrow(InvalidLogFileNameError);
    },
  );

  it('rejects a file with no recognized events and provides an anonymized example', () => {
    expect(() => parseBdoLog('2026-08-29.log', 'not an event')).toThrow(UnrecognizedLogError);

    try {
      parseBdoLog('2026-08-29.log', 'not an event');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(UnrecognizedLogError);
      expect((error as UnrecognizedLogError).expectedFormat).toContain('FamilyA');
    }
  });
});
