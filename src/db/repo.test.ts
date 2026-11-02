import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { summarize } from '../stats/engine';
import {
  addEvent,
  adjustScore,
  deleteMatch,
  endSet,
  finishMatch,
  loadAppData,
  reopenMatch,
  savePlayer,
  setScoreSide,
  startMatch,
  undoEvent,
} from './repo';
import { db } from './schema';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

async function newMatch() {
  const matchId = await startMatch({ opponent: ' Ridgeline ', matchDate: '2026-03-07', event: 'League' });
  const data = await loadAppData();
  return { matchId, set1: data.sets.find((s) => s.matchId === matchId && s.setNumber === 1)! };
}

describe('startMatch', () => {
  it('creates the match, a player and Set 1', async () => {
    const { matchId, set1 } = await newMatch();
    const data = await loadAppData();
    expect(data.matches).toHaveLength(1);
    expect(data.matches[0]).toMatchObject({ id: matchId, opponent: 'Ridgeline', event: 'League', done: false });
    expect(data.matches[0].playerId).toBe(data.player?.id);
    expect(data.sets).toHaveLength(1);
    expect(set1).toMatchObject({ matchId, setNumber: 1, scoreUs: null, scoreThem: null });
  });

  it('reuses the same player for later matches', async () => {
    await newMatch();
    await newMatch();
    expect(await db.players.count()).toBe(1);
  });
});

describe('savePlayer', () => {
  it('saves name and jersey, falling back to Son for a blank name', async () => {
    await savePlayer('  Sam ', ' 12 ');
    expect((await loadAppData()).player).toMatchObject({ name: 'Sam', jersey: '12' });
    await savePlayer('   ', '12');
    expect((await loadAppData()).player?.name).toBe('Son');
  });
});

describe('taps and undo', () => {
  it('writes each tap to the local database with the match id of its set', async () => {
    const { matchId, set1 } = await newMatch();
    await addEvent(set1.id, { kind: 'pass', value: 3 });
    await addEvent(set1.id, { kind: 'serve', value: 'ace' });
    await addEvent(set1.id, { kind: 'hit', value: 'error' });
    const { events } = await loadAppData();
    expect(events).toHaveLength(3);
    expect(events.every((e) => e.matchId === matchId && e.setId === set1.id)).toBe(true);
  });

  it('is idempotent: replaying the same event id never double counts', async () => {
    const { set1 } = await newMatch();
    await addEvent(set1.id, { kind: 'pass', value: 2 }, 'fixed-id');
    await addEvent(set1.id, { kind: 'pass', value: 2 }, 'fixed-id');
    expect((await loadAppData()).events).toHaveLength(1);
  });

  it('undo soft-deletes: the row stays, the stats drop it', async () => {
    const { set1 } = await newMatch();
    const keep = await addEvent(set1.id, { kind: 'pass', value: 3 });
    const gone = await addEvent(set1.id, { kind: 'pass', value: 0 });
    await undoEvent(gone);

    expect(await db.events.count()).toBe(2);
    expect((await db.events.get(gone))?.deletedAt).toBeTruthy();
    const { events } = await loadAppData();
    expect(events.map((e) => e.id)).toEqual([keep]);
    expect(summarize(events).pass.average).toBe(3);
  });

  it('undoing twice keeps the first deletion time', async () => {
    const { set1 } = await newMatch();
    const id = await addEvent(set1.id, { kind: 'hit', value: 'kill' });
    await undoEvent(id);
    const first = (await db.events.get(id))?.deletedAt;
    await undoEvent(id);
    expect((await db.events.get(id))?.deletedAt).toBe(first);
  });

  it('rejects a tap for a set that does not exist', async () => {
    await expect(addEvent('nope', { kind: 'pass', value: 1 })).rejects.toThrow();
  });
});

describe('score', () => {
  it('adds and removes points, never below zero', async () => {
    const { set1 } = await newMatch();
    await adjustScore(set1.id, 'us', 1);
    await adjustScore(set1.id, 'us', 1);
    await adjustScore(set1.id, 'them', 1);
    let s = (await loadAppData()).sets[0];
    expect([s.scoreUs, s.scoreThem]).toEqual([2, 1]);

    await adjustScore(set1.id, 'them', -1);
    await adjustScore(set1.id, 'them', -1);
    s = (await loadAppData()).sets[0];
    expect([s.scoreUs, s.scoreThem]).toEqual([2, 0]);
  });

  it('sets one side by hand and can clear it', async () => {
    const { set1 } = await newMatch();
    await setScoreSide(set1.id, 'us', 25);
    await setScoreSide(set1.id, 'them', 21);
    await setScoreSide(set1.id, 'them', null);
    const s = (await loadAppData()).sets[0];
    expect([s.scoreUs, s.scoreThem]).toEqual([25, null]);
  });
});

describe('sets and finishing', () => {
  it('endSet saves the score and starts the next set once', async () => {
    const { matchId, set1 } = await newMatch();
    const set2Id = await endSet(matchId, 1, { us: 25, them: 20 });
    const again = await endSet(matchId, 1, { us: 25, them: 20 });
    expect(again).toBe(set2Id);

    const { sets } = await loadAppData();
    expect(sets.map((s) => s.setNumber)).toEqual([1, 2]);
    expect(sets[0]).toMatchObject({ id: set1.id, scoreUs: 25, scoreThem: 20 });
    expect(sets[1]).toMatchObject({ id: set2Id, scoreUs: null });
  });

  it('finishMatch marks Final and creates no extra set', async () => {
    const { matchId } = await newMatch();
    await finishMatch(matchId, 1, { us: 25, them: 18 });
    const data = await loadAppData();
    expect(data.matches[0].done).toBe(true);
    expect(data.sets).toHaveLength(1);
    expect(data.sets[0]).toMatchObject({ scoreUs: 25, scoreThem: 18 });
  });

  it('a Final match can be reopened', async () => {
    const { matchId } = await newMatch();
    await finishMatch(matchId, 1, { us: null, them: null });
    await reopenMatch(matchId);
    expect((await loadAppData()).matches[0].done).toBe(false);
  });
});

describe('deleteMatch', () => {
  it('removes the match, its sets and its stats from every view', async () => {
    const a = await newMatch();
    const b = await newMatch();
    await addEvent(a.set1.id, { kind: 'pass', value: 3 });
    await addEvent(b.set1.id, { kind: 'pass', value: 1 });

    await deleteMatch(a.matchId);

    const data = await loadAppData();
    expect(data.matches.map((m) => m.id)).toEqual([b.matchId]);
    expect(data.sets.map((s) => s.matchId)).toEqual([b.matchId]);
    expect(summarize(data.events).pass.average).toBe(1);
  });

  it('keeps the rows locally so a later sync can tell the cloud', async () => {
    const { matchId, set1 } = await newMatch();
    const id = await addEvent(set1.id, { kind: 'hit', value: 'kill' });
    await deleteMatch(matchId);
    expect((await db.matches.get(matchId))?.deletedAt).toBeTruthy();
    expect((await db.events.get(id))?.deletedAt).toBeTruthy();
  });
});

describe('survives a reload', () => {
  it('a fresh connection to the same database sees everything', async () => {
    const { matchId, set1 } = await newMatch();
    await addEvent(set1.id, { kind: 'pass', value: 2 });
    await adjustScore(set1.id, 'us', 1);

    const { SideOutDB } = await import('./schema');
    const reopened = new SideOutDB();
    expect(await reopened.matches.get(matchId)).toBeTruthy();
    expect(await reopened.events.count()).toBe(1);
    expect((await reopened.sets.get(set1.id))?.scoreUs).toBe(1);
    reopened.close();
  });
});
