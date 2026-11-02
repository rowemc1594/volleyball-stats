import { describe, expect, it } from 'vitest';
import type { Match, Player, SetRow } from './db/schema';
import {
  activeMatch,
  dateParts,
  describeEvent,
  newestFirst,
  reportText,
  setRecord,
  setsOf,
  shortDate,
  todayLocal,
} from './domain';
import { parseHash } from './router';
import type { StatEvent } from './stats/types';

const set = (n: number, us: number | null, them: number | null, matchId = 'm1'): SetRow => ({
  id: `s${n}`,
  matchId,
  setNumber: n,
  scoreUs: us,
  scoreThem: them,
});
const match = (id: string, done: boolean): Match => ({
  id,
  playerId: 'p',
  opponent: 'Ridgeline',
  matchDate: '2026-03-07',
  event: '',
  done,
  createdAt: '2026-03-07T10:00:00Z',
});

describe('dates', () => {
  it('formats today in local time', () => {
    expect(todayLocal(new Date(2026, 2, 7, 23, 59))).toBe('2026-03-07');
    expect(todayLocal(new Date(2026, 10, 1))).toBe('2026-11-01');
  });
  it('splits a match date for display', () => {
    expect(dateParts('2026-03-07')).toEqual({ month: 'Mar', day: 7 });
    expect(shortDate('2026-12-25')).toBe('Dec 25');
  });
});

describe('setRecord', () => {
  it('counts sets won and lost', () => {
    expect(setRecord([set(1, 25, 20), set(2, 18, 25), set(3, 15, 12)])).toEqual({
      won: 2,
      lost: 1,
      label: '2–1',
    });
  });
  it('ignores sets without both scores, and has no label when nothing is scored', () => {
    expect(setRecord([set(1, 25, null), set(2, null, null)]).label).toBe('');
    expect(setRecord([set(1, 25, 20), set(2, null, null)]).label).toBe('1–0');
  });
  it('does not count a tie', () => {
    expect(setRecord([set(1, 20, 20)])).toMatchObject({ won: 0, lost: 0, label: '0–0' });
  });
});

describe('setsOf', () => {
  it('returns one match sets in order', () => {
    const all = [set(2, 0, 0), set(1, 0, 0), set(1, 0, 0, 'other')];
    expect(setsOf(all, 'm1').map((s) => s.setNumber)).toEqual([1, 2]);
  });
});

describe('activeMatch', () => {
  it('is the first match that is not Final', () => {
    expect(activeMatch([match('a', true), match('b', false), match('c', false)])?.id).toBe('b');
    expect(activeMatch([match('a', true)])).toBeUndefined();
  });
});

describe('history helpers', () => {
  const ev = (over: Partial<StatEvent>, t: string): StatEvent =>
    ({ id: t, setId: 's1', matchId: 'm1', occurredAt: t, kind: 'pass', value: 3, ...over }) as StatEvent;

  it('describes each kind of tap', () => {
    expect(describeEvent(ev({}, 'a'))).toBe('Pass 3');
    expect(describeEvent(ev({ kind: 'serve', value: 'error' }, 'a'))).toBe('Serve · Fault');
    expect(describeEvent(ev({ kind: 'hit', value: 'in' }, 'a'))).toBe('Hit · In-Play');
  });
  it('sorts newest first', () => {
    const sorted = newestFirst([ev({}, '2026-01-01T00:00:01Z'), ev({}, '2026-01-01T00:00:03Z'), ev({}, '2026-01-01T00:00:02Z')]);
    expect(sorted.map((e) => e.id)).toEqual([
      '2026-01-01T00:00:03Z',
      '2026-01-01T00:00:02Z',
      '2026-01-01T00:00:01Z',
    ]);
  });
});

describe('reportText', () => {
  const player: Player = { id: 'p', name: 'Sam', jersey: '12' };
  const events: StatEvent[] = [
    { id: '1', setId: 's1', matchId: 'm1', occurredAt: 'a', kind: 'pass', value: 3 },
    { id: '2', setId: 's1', matchId: 'm1', occurredAt: 'b', kind: 'pass', value: 1 },
    { id: '3', setId: 's1', matchId: 'm1', occurredAt: 'c', kind: 'serve', value: 'ace' },
    { id: '4', setId: 's1', matchId: 'm1', occurredAt: 'd', kind: 'serve', value: 'error' },
    { id: '5', setId: 's1', matchId: 'm1', occurredAt: 'e', kind: 'hit', value: 'kill' },
    { id: '6', setId: 's1', matchId: 'm1', occurredAt: 'f', kind: 'hit', value: 'in' },
    { id: '7', setId: 's1', matchId: 'other', occurredAt: 'g', kind: 'pass', value: 0 },
  ];

  it('summarises only this match', () => {
    const text = reportText(player, match('m1', false), [set(1, 25, 20)], events);
    expect(text).toBe(
      [
        'Sam #12 vs Ridgeline (Mar 7)',
        'Sets: 25-20',
        'Passing: 2.00 avg on 2 (3s 1, 2s 0, 1s 1, 0s 0), in-system 50%',
        'Serving: 1/2 in, 1 aces, 1 faults',
        'Hitting: .500 (1 K, 0 E, 2 att)',
      ].join('\n'),
    );
  });

  it('shows dashes with no data and omits the sets line', () => {
    const text = reportText(undefined, match('m1', false), [set(1, null, null)], []);
    expect(text).toContain('Son vs Ridgeline');
    expect(text).not.toContain('Sets:');
    expect(text).toContain('Passing: – avg on 0');
  });
});

describe('parseHash', () => {
  it('defaults to Matches', () => {
    expect(parseHash('')).toEqual({ name: 'matches' });
    expect(parseHash('#/')).toEqual({ name: 'matches' });
    expect(parseHash('#/nonsense')).toEqual({ name: 'matches' });
  });
  it('reads the season, track and match routes', () => {
    expect(parseHash('#/season')).toEqual({ name: 'season' });
    expect(parseHash('#/track/abc-123')).toEqual({ name: 'track', matchId: 'abc-123' });
    expect(parseHash('#/match/abc-123')).toEqual({ name: 'match', matchId: 'abc-123' });
  });
  it('falls back to Matches when a match id is missing', () => {
    expect(parseHash('#/track')).toEqual({ name: 'matches' });
  });
});
