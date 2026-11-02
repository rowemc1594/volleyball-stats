import type { Match, Player, SetRow } from './db/schema';
import {
  eventsForMatch,
  formatAverage,
  formatHitting,
  formatPercent,
  summarize,
} from './stats/engine';
import type { StatEvent } from './stats/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Today as YYYY-MM-DD in the device's own timezone. */
export function todayLocal(now = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

/** "2026-03-07" -> { month: 'Mar', day: 7 } */
export function dateParts(matchDate: string): { month: string; day: number | '' } {
  const [, m, d] = matchDate.split('-').map(Number);
  return { month: MONTHS[(m || 1) - 1], day: d || '' };
}

export function shortDate(matchDate: string): string {
  const { month, day } = dateParts(matchDate);
  return `${month} ${day}`;
}

export function setsOf(sets: readonly SetRow[], matchId: string): SetRow[] {
  return sets.filter((s) => s.matchId === matchId).sort((a, b) => a.setNumber - b.setNumber);
}

/** Sets won and lost. Only sets with both scores entered count. */
export function setRecord(matchSets: readonly SetRow[]): { won: number; lost: number; label: string } {
  let won = 0;
  let lost = 0;
  let any = false;
  for (const s of matchSets) {
    if (s.scoreUs == null || s.scoreThem == null) continue;
    any = true;
    if (s.scoreUs > s.scoreThem) won++;
    else if (s.scoreThem > s.scoreUs) lost++;
  }
  return { won, lost, label: any ? `${won}–${lost}` : '' };
}

/** The match to offer under "Resume": the newest one not marked Final. */
export function activeMatch(matches: readonly Match[]): Match | undefined {
  return matches.find((m) => !m.done);
}

export function describeEvent(e: StatEvent): string {
  switch (e.kind) {
    case 'pass':
      return `Pass ${e.value}`;
    case 'serve':
      return `Serve · ${{ ace: 'Ace', in: 'In', error: 'Fault' }[e.value]}`;
    case 'hit':
      return `Hit · ${{ kill: 'Kill', in: 'In-Play', error: 'Error' }[e.value]}`;
  }
}

/** Newest first. */
export function newestFirst(events: readonly StatEvent[]): StatEvent[] {
  return [...events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function reportText(
  player: Player | undefined,
  match: Match,
  matchSets: readonly SetRow[],
  allEvents: readonly StatEvent[],
): string {
  const s = summarize(eventsForMatch(allEvents, match.id));
  const who = `${player?.name || 'Son'}${player?.jersey ? ' #' + player.jersey : ''}`;
  const scores = matchSets
    .filter((x) => x.scoreUs != null || x.scoreThem != null)
    .map((x) => `${x.scoreUs ?? '-'}-${x.scoreThem ?? '-'}`);
  const lines = [`${who} vs ${match.opponent} (${shortDate(match.matchDate)})`];
  if (scores.length) lines.push(`Sets: ${scores.join(', ')}`);
  lines.push(
    `Passing: ${formatAverage(s.pass.average)} avg on ${s.pass.total} (3s ${s.pass.counts[3]}, 2s ${s.pass.counts[2]}, 1s ${s.pass.counts[1]}, 0s ${s.pass.counts[0]}), in-system ${formatPercent(s.pass.inSystemPct)}`,
    `Serving: ${s.serve.ace + s.serve.in}/${s.serve.total} in, ${s.serve.ace} aces, ${s.serve.error} faults`,
    `Hitting: ${formatHitting(s.hit.hittingPct)} (${s.hit.kill} K, ${s.hit.error} E, ${s.hit.attempts} att)`,
  );
  return lines.join('\n');
}
