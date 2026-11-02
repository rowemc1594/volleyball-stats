import { describe, expect, it } from 'vitest';
import {
  activeEvents,
  eventsForMatch,
  eventsForSet,
  formatAverage,
  formatHitting,
  formatPercent,
  hitStats,
  passStats,
  serveStats,
  summarize,
} from './engine';
import type { HitValue, PassValue, ServeValue, StatEvent } from './types';

let n = 0;
const base = (setId = 's1', matchId = 'm1') => ({
  id: `e${++n}`,
  setId,
  matchId,
  occurredAt: '2026-01-01T00:00:00Z',
});
const pass = (value: PassValue, setId?: string, matchId?: string): StatEvent => ({
  ...base(setId, matchId),
  kind: 'pass',
  value,
});
const serve = (value: ServeValue, setId?: string, matchId?: string): StatEvent => ({
  ...base(setId, matchId),
  kind: 'serve',
  value,
});
const hit = (value: HitValue, setId?: string, matchId?: string): StatEvent => ({
  ...base(setId, matchId),
  kind: 'hit',
  value,
});
const undone = (e: StatEvent): StatEvent => ({ ...e, deletedAt: '2026-01-01T00:01:00Z' });
const times = (count: number, make: () => StatEvent) => Array.from({ length: count }, make);

describe('passStats', () => {
  it('returns nulls and zero counts with no passes', () => {
    expect(passStats([])).toEqual({
      total: 0,
      counts: [0, 0, 0, 0],
      average: null,
      inSystemPct: null,
    });
  });

  it('computes the pass average as (1*n1 + 2*n2 + 3*n3) / total', () => {
    // 0,1,2,2,3,3,3 -> (0 + 1 + 4 + 9) / 7 = 2
    const s = passStats([0, 1, 2, 2, 3, 3, 3].map((v) => pass(v as PassValue)));
    expect(s.total).toBe(7);
    expect(s.counts).toEqual([1, 1, 2, 3]);
    expect(s.average).toBeCloseTo(2, 10);
  });

  it('counts zeros in the denominator', () => {
    expect(passStats([pass(0), pass(0), pass(3)]).average).toBeCloseTo(1, 10);
  });

  it('is 0 when every pass is a 0', () => {
    expect(passStats([pass(0), pass(0)]).average).toBe(0);
  });

  it('is 3 when every pass is perfect', () => {
    expect(passStats([pass(3), pass(3)]).average).toBe(3);
  });

  it('computes in-system % as 2s and 3s over total', () => {
    expect(passStats([pass(3), pass(2), pass(1), pass(0)]).inSystemPct).toBe(0.5);
  });

  it('ignores serve and hit events', () => {
    const s = passStats([pass(2), serve('ace'), hit('kill')]);
    expect(s.total).toBe(1);
    expect(s.average).toBe(2);
  });
});

describe('serveStats', () => {
  it('returns nulls with no serves', () => {
    expect(serveStats([])).toEqual({
      total: 0,
      ace: 0,
      in: 0,
      error: 0,
      inPct: null,
      acePct: null,
      errorPct: null,
    });
  });

  it('computes serve-in, ace and error percentages', () => {
    // 2 aces, 5 in, 3 errors out of 10
    const s = serveStats([
      ...times(2, () => serve('ace')),
      ...times(5, () => serve('in')),
      ...times(3, () => serve('error')),
    ]);
    expect(s).toMatchObject({ total: 10, ace: 2, in: 5, error: 3 });
    expect(s.inPct).toBeCloseTo(0.7, 10);
    expect(s.acePct).toBeCloseTo(0.2, 10);
    expect(s.errorPct).toBeCloseTo(0.3, 10);
  });

  it('serve-in % plus error % is always 100%', () => {
    const s = serveStats([serve('ace'), serve('in'), serve('error'), serve('error')]);
    expect(s.inPct! + s.errorPct!).toBeCloseTo(1, 10);
  });

  it('is 0% serve-in when all serves are errors', () => {
    const s = serveStats([serve('error'), serve('error')]);
    expect(s.inPct).toBe(0);
    expect(s.errorPct).toBe(1);
  });
});

describe('hitStats', () => {
  it('returns null hitting % with zero attempts', () => {
    expect(hitStats([])).toEqual({
      attempts: 0,
      kill: 0,
      in: 0,
      error: 0,
      hittingPct: null,
    });
  });

  it('computes (kills - errors) / attempts', () => {
    // 5 kills, 3 in, 2 errors = 10 attempts -> (5 - 2) / 10 = .300
    const s = hitStats([
      ...times(5, () => hit('kill')),
      ...times(3, () => hit('in')),
      ...times(2, () => hit('error')),
    ]);
    expect(s.attempts).toBe(10);
    expect(s.hittingPct).toBeCloseTo(0.3, 10);
  });

  it('counts in-play hits as attempts that neither help nor hurt', () => {
    const s = hitStats([hit('in'), hit('in'), hit('kill')]);
    expect(s.attempts).toBe(3);
    expect(s.hittingPct).toBeCloseTo(1 / 3, 10);
  });

  it('can be negative when errors outnumber kills', () => {
    const s = hitStats([hit('kill'), hit('error'), hit('error'), hit('in')]);
    expect(s.hittingPct).toBeCloseTo(-0.25, 10);
  });

  it('is exactly 0 when kills equal errors', () => {
    expect(hitStats([hit('kill'), hit('error')]).hittingPct).toBe(0);
  });

  it('is 1.000 with all kills and -1.000 with all errors', () => {
    expect(hitStats([hit('kill'), hit('kill')]).hittingPct).toBe(1);
    expect(hitStats([hit('error')]).hittingPct).toBe(-1);
  });
});

describe('undo (soft delete)', () => {
  it('excludes deleted events from every stat', () => {
    const events = [
      pass(3),
      undone(pass(0)),
      serve('ace'),
      undone(serve('error')),
      hit('kill'),
      undone(hit('error')),
    ];
    expect(activeEvents(events)).toHaveLength(3);
    const s = summarize(events);
    expect(s.pass.average).toBe(3);
    expect(s.serve.errorPct).toBe(0);
    expect(s.hit.hittingPct).toBe(1);
  });

  it('treats an explicit null deletedAt as active', () => {
    const e: StatEvent = { ...pass(2), deletedAt: null };
    expect(passStats([e]).total).toBe(1);
  });

  it('goes back to empty when the only event is undone', () => {
    expect(passStats([undone(pass(3))]).average).toBeNull();
  });
});

describe('scoping by set and match', () => {
  const events = [
    pass(3, 's1', 'm1'),
    pass(1, 's2', 'm1'),
    pass(0, 's3', 'm2'),
    hit('kill', 's1', 'm1'),
  ];

  it('filters by set', () => {
    expect(eventsForSet(events, 's1')).toHaveLength(2);
    expect(passStats(eventsForSet(events, 's2')).average).toBe(1);
  });

  it('filters by match', () => {
    expect(eventsForMatch(events, 'm1')).toHaveLength(3);
    expect(passStats(eventsForMatch(events, 'm1')).average).toBe(2);
  });

  it('season totals are just all events, nothing stored', () => {
    expect(passStats(events).total).toBe(3);
  });
});

describe('hand-calculated sample match', () => {
  const set1: StatEvent[] = [
    pass(3, 's1'), pass(3, 's1'), pass(2, 's1'), pass(1, 's1'),
    serve('ace', 's1'), serve('in', 's1'), serve('in', 's1'), serve('error', 's1'),
    hit('kill', 's1'), hit('kill', 's1'), hit('in', 's1'), hit('error', 's1'),
  ];
  const set2: StatEvent[] = [
    pass(2, 's2'), pass(0, 's2'), pass(3, 's2'),
    serve('in', 's2'), serve('in', 's2'), serve('error', 's2'),
    hit('kill', 's2'), hit('in', 's2'), hit('in', 's2'),
  ];

  it('set 1', () => {
    const s = summarize(set1);
    expect(s.pass.average).toBeCloseTo(9 / 4, 10);
    expect(s.serve.inPct).toBeCloseTo(3 / 4, 10);
    expect(s.hit.hittingPct).toBeCloseTo(1 / 4, 10);
  });

  it('whole match', () => {
    const s = summarize([...set1, ...set2]);
    // passes: 3+3+2+1+2+0+3 = 14 over 7 = 2.0
    expect(s.pass.average).toBeCloseTo(2, 10);
    // serves: 1 ace + 4 in = 5 of 7
    expect(s.serve.inPct).toBeCloseTo(5 / 7, 10);
    // hits: 7 attempts, 3 kills, 1 error
    expect(s.hit.attempts).toBe(7);
    expect(s.hit.hittingPct).toBeCloseTo(2 / 7, 10);
  });
});

describe('formatting', () => {
  it('formats pass averages to two decimals', () => {
    expect(formatAverage(2)).toBe('2.00');
    expect(formatAverage(2.1428)).toBe('2.14');
    expect(formatAverage(null)).toBe('–');
  });

  it('formats whole percents', () => {
    expect(formatPercent(0.7)).toBe('70%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(null)).toBe('–');
  });

  it('formats hitting % volleyball style', () => {
    expect(formatHitting(0.25)).toBe('.250');
    expect(formatHitting(-0.1)).toBe('-.100');
    expect(formatHitting(1)).toBe('1.000');
    expect(formatHitting(-1)).toBe('-1.000');
    expect(formatHitting(0)).toBe('.000');
    expect(formatHitting(null)).toBe('–');
  });

  it('does not show a negative zero', () => {
    expect(formatHitting(-0.0001)).toBe('.000');
  });
});
