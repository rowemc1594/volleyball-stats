import type { HitValue, PassValue, ServeValue, StatEvent } from '../stats/types';
import { db, type Match, type Player, type SetRow } from './schema';

const uuid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

export type StatInput =
  | { kind: 'pass'; value: PassValue }
  | { kind: 'serve'; value: ServeValue }
  | { kind: 'hit'; value: HitValue };

export interface SetScore {
  us: number | null;
  them: number | null;
}

export interface AppData {
  player: Player | undefined;
  /** Newest first. Deleted matches are left out. */
  matches: Match[];
  sets: SetRow[];
  /** Only events that have not been undone, and that belong to a kept match. */
  events: StatEvent[];
}

/** Read everything the screens need. Call inside liveQuery so the UI follows the database. */
export async function loadAppData(): Promise<AppData> {
  const [players, allMatches, allSets, allEvents] = await Promise.all([
    db.players.toArray(),
    db.matches.toArray(),
    db.sets.toArray(),
    db.events.toArray(),
  ]);
  const matches = allMatches
    .filter((m) => m.deletedAt == null)
    .sort((a, b) => b.matchDate.localeCompare(a.matchDate) || b.createdAt.localeCompare(a.createdAt));
  const kept = new Set(matches.map((m) => m.id));
  return {
    player: players[0],
    matches,
    sets: allSets
      .filter((s) => kept.has(s.matchId))
      .sort((a, b) => a.setNumber - b.setNumber),
    events: allEvents.filter((e) => e.deletedAt == null && kept.has(e.matchId)),
  };
}

/** There is one player in v1. Created on first use so every match has a player_id. */
async function ensurePlayer(): Promise<Player> {
  const existing = await db.players.toCollection().first();
  if (existing) return existing;
  const player: Player = { id: uuid(), name: 'Son', jersey: '' };
  await db.players.add(player);
  return player;
}

export async function savePlayer(name: string, jersey: string): Promise<void> {
  const player = await ensurePlayer();
  await db.players.update(player.id, { name: name.trim() || 'Son', jersey: jersey.trim() });
}

export async function startMatch(input: {
  opponent: string;
  matchDate: string;
  event?: string;
}): Promise<string> {
  return db.transaction('rw', db.players, db.matches, db.sets, async () => {
    const player = await ensurePlayer();
    const match: Match = {
      id: uuid(),
      playerId: player.id,
      opponent: input.opponent.trim(),
      matchDate: input.matchDate,
      event: (input.event ?? '').trim(),
      done: false,
      createdAt: nowIso(),
    };
    await db.matches.add(match);
    await db.sets.add({ id: uuid(), matchId: match.id, setNumber: 1, scoreUs: null, scoreThem: null });
    return match.id;
  });
}

/**
 * Record one tap. The id is generated here, and put() on an existing id just
 * rewrites the same row, so a retry can never count twice.
 */
export async function addEvent(setId: string, input: StatInput, id: string = uuid()): Promise<string> {
  const set = await db.sets.get(setId);
  if (!set) throw new Error(`Unknown set ${setId}`);
  const event = { id, setId, matchId: set.matchId, occurredAt: nowIso(), ...input } as StatEvent;
  await db.events.put(event);
  return id;
}

/** Undo marks the row deleted. The row stays so a later sync can propagate it. */
export async function undoEvent(id: string): Promise<void> {
  const event = await db.events.get(id);
  if (event && event.deletedAt == null) await db.events.update(id, { deletedAt: nowIso() });
}

/** Add or remove a point for the current set. Both sides are saved so the score is complete. */
export async function adjustScore(setId: string, side: 'us' | 'them', delta: number): Promise<void> {
  await db.transaction('rw', db.sets, async () => {
    const set = await db.sets.get(setId);
    if (!set) return;
    let us = set.scoreUs ?? 0;
    let them = set.scoreThem ?? 0;
    if (side === 'us') us = Math.max(0, us + delta);
    else them = Math.max(0, them + delta);
    await db.sets.update(setId, { scoreUs: us, scoreThem: them });
  });
}

/** Set one side of a set score by hand. null clears it. */
export async function setScoreSide(setId: string, side: 'us' | 'them', value: number | null): Promise<void> {
  await db.sets.update(setId, side === 'us' ? { scoreUs: value } : { scoreThem: value });
}

async function saveScore(matchId: string, setNumber: number, score: SetScore): Promise<SetRow> {
  const set = await db.sets.where('[matchId+setNumber]').equals([matchId, setNumber]).first();
  if (!set) throw new Error(`Match ${matchId} has no set ${setNumber}`);
  await db.sets.update(set.id, { scoreUs: score.us, scoreThem: score.them });
  return set;
}

/** Save the final score of this set and start the next one. Returns the new set's id. */
export async function endSet(matchId: string, setNumber: number, score: SetScore): Promise<string> {
  return db.transaction('rw', db.sets, async () => {
    await saveScore(matchId, setNumber, score);
    const next = await db.sets.where('[matchId+setNumber]').equals([matchId, setNumber + 1]).first();
    if (next) return next.id;
    const row: SetRow = { id: uuid(), matchId, setNumber: setNumber + 1, scoreUs: null, scoreThem: null };
    await db.sets.add(row);
    return row.id;
  });
}

/** Save the final score and mark the match Final. No empty extra set is created. */
export async function finishMatch(matchId: string, setNumber: number, score: SetScore): Promise<void> {
  await db.transaction('rw', db.sets, db.matches, async () => {
    await saveScore(matchId, setNumber, score);
    await db.matches.update(matchId, { done: true });
  });
}

export async function reopenMatch(matchId: string): Promise<void> {
  await db.matches.update(matchId, { done: false });
}

/** Hides the match and its taps everywhere. Nothing is physically removed yet. */
export async function deleteMatch(matchId: string): Promise<void> {
  const at = nowIso();
  await db.transaction('rw', db.matches, db.events, async () => {
    await db.matches.update(matchId, { deletedAt: at });
    await db.events.where('matchId').equals(matchId).modify((e) => {
      if (e.deletedAt == null) e.deletedAt = at;
    });
  });
}
