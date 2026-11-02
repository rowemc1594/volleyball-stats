import type { StatEvent } from './types';

/*
 * Stat definitions follow docs/PLAN.md section 3.
 *
 * Ratios are returned as fractions (0.25 means 25%, or a hitting % of .250).
 * When there is nothing to divide by they are `null`, never NaN or 0, so the
 * UI can show a dash instead of a misleading zero.
 */

export interface PassStats {
  total: number;
  /** Counts of each pass grade, indexed 0..3. */
  counts: [number, number, number, number];
  /** (1*n1 + 2*n2 + 3*n3) / total */
  average: number | null;
  /** Share of passes graded 2 or 3. */
  inSystemPct: number | null;
}

export interface ServeStats {
  total: number;
  ace: number;
  in: number;
  error: number;
  /** (aces + in) / serves */
  inPct: number | null;
  acePct: number | null;
  errorPct: number | null;
}

export interface HitStats {
  /** kills + in + errors */
  attempts: number;
  kill: number;
  in: number;
  error: number;
  /** (kills - errors) / attempts. Can be negative. */
  hittingPct: number | null;
}

export interface StatSummary {
  pass: PassStats;
  serve: ServeStats;
  hit: HitStats;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

/** Drops events that were undone (soft deleted). */
export function activeEvents(events: readonly StatEvent[]): StatEvent[] {
  return events.filter((e) => e.deletedAt == null);
}

export function eventsForSet(events: readonly StatEvent[], setId: string): StatEvent[] {
  return events.filter((e) => e.setId === setId);
}

export function eventsForMatch(events: readonly StatEvent[], matchId: string): StatEvent[] {
  return events.filter((e) => e.matchId === matchId);
}

export function passStats(events: readonly StatEvent[]): PassStats {
  const counts: [number, number, number, number] = [0, 0, 0, 0];
  for (const e of activeEvents(events)) {
    if (e.kind === 'pass') counts[e.value]++;
  }
  const total = counts[0] + counts[1] + counts[2] + counts[3];
  return {
    total,
    counts,
    average: ratio(counts[1] + 2 * counts[2] + 3 * counts[3], total),
    inSystemPct: ratio(counts[2] + counts[3], total),
  };
}

export function serveStats(events: readonly StatEvent[]): ServeStats {
  let ace = 0;
  let inPlay = 0;
  let error = 0;
  for (const e of activeEvents(events)) {
    if (e.kind !== 'serve') continue;
    if (e.value === 'ace') ace++;
    else if (e.value === 'in') inPlay++;
    else error++;
  }
  const total = ace + inPlay + error;
  return {
    total,
    ace,
    in: inPlay,
    error,
    inPct: ratio(ace + inPlay, total),
    acePct: ratio(ace, total),
    errorPct: ratio(error, total),
  };
}

export function hitStats(events: readonly StatEvent[]): HitStats {
  let kill = 0;
  let inPlay = 0;
  let error = 0;
  for (const e of activeEvents(events)) {
    if (e.kind !== 'hit') continue;
    if (e.value === 'kill') kill++;
    else if (e.value === 'in') inPlay++;
    else error++;
  }
  const attempts = kill + inPlay + error;
  return { attempts, kill, in: inPlay, error, hittingPct: ratio(kill - error, attempts) };
}

export function summarize(events: readonly StatEvent[]): StatSummary {
  return { pass: passStats(events), serve: serveStats(events), hit: hitStats(events) };
}

/* Display formatting. Kept here so every screen shows numbers the same way. */

const DASH = '–';

/** Pass average to two decimals: 2.14 */
export function formatAverage(value: number | null): string {
  return value === null ? DASH : value.toFixed(2);
}

/** Whole-number percent: 83% */
export function formatPercent(value: number | null): string {
  return value === null ? DASH : `${Math.round(value * 100)}%`;
}

/** Volleyball style hitting percentage: .250, -.100, 1.000 */
export function formatHitting(value: number | null): string {
  if (value === null) return DASH;
  const fixed = Math.abs(value).toFixed(3);
  const body = fixed.startsWith('0') ? fixed.slice(1) : fixed;
  return value < 0 && Number(fixed) !== 0 ? `-${body}` : body;
}
