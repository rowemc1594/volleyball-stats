import type { Match, Player, SetRow } from '../db/schema';
import type { StatEvent } from '../stats/types';

/** A row as the cloud stores it: snake_case columns. */
export type CloudRow = Record<string, unknown>;

const iso = (v: unknown): string => new Date(v as string).toISOString();
const isoOrNull = (v: unknown): string | null => (v == null ? null : iso(v));

export const playerToCloud = (p: Player): CloudRow => ({ id: p.id, name: p.name, jersey: p.jersey });
export const playerFromCloud = (r: CloudRow): Player => ({
  id: r.id as string,
  name: r.name as string,
  jersey: r.jersey as string,
});

export const matchToCloud = (m: Match): CloudRow => ({
  id: m.id,
  player_id: m.playerId,
  opponent: m.opponent,
  match_date: m.matchDate,
  event: m.event,
  done: m.done,
  created_at: m.createdAt,
  deleted_at: m.deletedAt ?? null,
});
export const matchFromCloud = (r: CloudRow): Match => ({
  id: r.id as string,
  playerId: r.player_id as string,
  opponent: r.opponent as string,
  matchDate: r.match_date as string,
  event: r.event as string,
  done: r.done as boolean,
  createdAt: iso(r.created_at),
  deletedAt: isoOrNull(r.deleted_at),
});

export const setToCloud = (s: SetRow): CloudRow => ({
  id: s.id,
  match_id: s.matchId,
  set_number: s.setNumber,
  score_us: s.scoreUs,
  score_them: s.scoreThem,
});
export const setFromCloud = (r: CloudRow): SetRow => ({
  id: r.id as string,
  matchId: r.match_id as string,
  setNumber: r.set_number as number,
  scoreUs: (r.score_us as number | null) ?? null,
  scoreThem: (r.score_them as number | null) ?? null,
});

/** Pass values are numbers locally and text in the cloud (one column holds all three kinds). */
export const eventToCloud = (e: StatEvent): CloudRow => ({
  id: e.id,
  match_id: e.matchId,
  set_id: e.setId,
  kind: e.kind,
  value: String(e.value),
  occurred_at: e.occurredAt,
  deleted_at: e.deletedAt ?? null,
});
export const eventFromCloud = (r: CloudRow): StatEvent => {
  const kind = r.kind as StatEvent['kind'];
  const value = kind === 'pass' ? Number(r.value) : (r.value as string);
  return {
    id: r.id as string,
    matchId: r.match_id as string,
    setId: r.set_id as string,
    kind,
    value,
    occurredAt: iso(r.occurred_at),
    deletedAt: isoOrNull(r.deleted_at),
  } as StatEvent;
};
