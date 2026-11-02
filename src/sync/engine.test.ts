import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, SYNC_TABLES, type SyncTable } from '../db/schema';
import {
  addEvent,
  deleteMatch,
  loadAppData,
  savePlayer,
  startMatch,
  undoEvent,
} from '../db/repo';
import { pullChanges, pushOutbox, syncOnce, type Cloud } from './engine';
import type { CloudRow } from './mapping';

/** An in-memory stand-in for Supabase: upsert by id, a change clock, and switchable failures. */
class FakeCloud implements Cloud {
  tables: Record<SyncTable, Map<string, CloudRow>> = {
    players: new Map(),
    matches: new Map(),
    sets: new Map(),
    events: new Map(),
  };
  clock = 0;
  upsertCalls: { table: SyncTable; ids: string[] }[] = [];
  failNextUpserts = 0;

  async upsert(table: SyncTable, rows: CloudRow[]) {
    if (this.failNextUpserts > 0) {
      this.failNextUpserts--;
      throw new Error('network down');
    }
    this.upsertCalls.push({ table, ids: rows.map((r) => r.id as string) });
    for (const row of rows) {
      // Like the real server: foreign keys must already exist, and updated_at is server-stamped.
      if (table === 'matches') expect(this.tables.players.has(row.player_id as string)).toBe(true);
      if (table === 'sets') expect(this.tables.matches.has(row.match_id as string)).toBe(true);
      if (table === 'events') expect(this.tables.sets.has(row.set_id as string)).toBe(true);
      const stamp = new Date(Date.UTC(2026, 0, 1) + ++this.clock * 1000).toISOString();
      this.tables[table].set(row.id as string, { ...this.tables[table].get(row.id as string), ...row, updated_at: stamp });
    }
  }

  async fetchChanged(table: SyncTable, since: string | null, from: number, to: number) {
    return [...this.tables[table].values()]
      .filter((r) => !since || (r.updated_at as string) >= since)
      .sort((a, b) => (a.updated_at as string).localeCompare(b.updated_at as string) || (a.id as string).localeCompare(b.id as string))
      .slice(from, to + 1);
  }

  count(table: SyncTable) {
    return this.tables[table].size;
  }
}

async function wipeLocal() {
  await Promise.all([...SYNC_TABLES, 'outbox', 'meta'].map((t) => db.table(t).clear()));
}

async function playMatch(taps = 3) {
  const matchId = await startMatch({ opponent: 'Ridgeline', matchDate: '2026-03-01' });
  const set = (await db.sets.where('matchId').equals(matchId).first())!;
  const ids: string[] = [];
  for (let i = 0; i < taps; i++) ids.push(await addEvent(set.id, { kind: 'pass', value: 3 }));
  return { matchId, setId: set.id, ids };
}

beforeEach(wipeLocal);

describe('outbox', () => {
  it('queues one entry per changed row, however many times it changes', async () => {
    const { matchId, ids } = await playMatch(3);
    await undoEvent(ids[0]);
    await undoEvent(ids[0]); // second undo changes nothing
    const keys = (await db.outbox.toArray()).map((e) => e.key).sort();
    expect(keys).toEqual(
      [
        `matches:${matchId}`,
        `players:${(await db.players.toCollection().first())!.id}`,
        `sets:${(await db.sets.toCollection().first())!.id}`,
        ...ids.map((id) => `events:${id}`),
      ].sort(),
    );
  });

  it('queues the taps that a match delete hides', async () => {
    const { matchId, ids } = await playMatch(2);
    await db.outbox.clear();
    await deleteMatch(matchId);
    const keys = (await db.outbox.toArray()).map((e) => e.key);
    expect(keys).toEqual(expect.arrayContaining([`matches:${matchId}`, ...ids.map((id) => `events:${id}`)]));
  });
});

describe('push', () => {
  it('sends parents before children and empties the outbox', async () => {
    const cloud = new FakeCloud();
    await playMatch(3);
    await pushOutbox(cloud);
    expect(cloud.upsertCalls.map((c) => c.table)).toEqual(['players', 'matches', 'sets', 'events']);
    expect(cloud.count('events')).toBe(3);
    expect(await db.outbox.count()).toBe(0);
  });

  it('keeps everything queued when the network fails, then sends it with no duplicates', async () => {
    const cloud = new FakeCloud();
    await playMatch(5);
    cloud.failNextUpserts = 1;
    await expect(pushOutbox(cloud)).rejects.toThrow('network down');
    expect(await db.outbox.count()).toBe(8); // player, match, set, 5 events

    // Retry several times, even after success: the cloud never holds more than one row per tap.
    await pushOutbox(cloud);
    await pushOutbox(cloud);
    expect(cloud.count('events')).toBe(5);
    expect(cloud.count('matches')).toBe(1);
    expect(await db.outbox.count()).toBe(0);
  });

  it('keeps entries that failed part way and clears the ones already accepted', async () => {
    const cloud = new FakeCloud();
    await playMatch(2);
    // players, matches and sets succeed, then the events upsert fails.
    const original = cloud.upsert.bind(cloud);
    cloud.upsert = async (table, rows) => {
      if (table === 'events') throw new Error('boom');
      return original(table, rows);
    };
    await expect(pushOutbox(cloud)).rejects.toThrow('boom');
    expect((await db.outbox.toArray()).map((e) => e.table)).toEqual(['events', 'events']);
  });

  it('does not clear a row that was edited while the send was in flight', async () => {
    const cloud = new FakeCloud();
    const { ids } = await playMatch(1);
    const original = cloud.upsert.bind(cloud);
    cloud.upsert = async (table, rows) => {
      await original(table, rows);
      if (table === 'events') await undoEvent(ids[0]); // edited mid-send
    };
    await pushOutbox(cloud);
    expect((await db.outbox.toArray()).map((e) => e.key)).toEqual([`events:${ids[0]}`]);

    cloud.upsert = original;
    await pushOutbox(cloud);
    expect(cloud.tables.events.get(ids[0])!.deleted_at).not.toBeNull();
    expect(await db.outbox.count()).toBe(0);
  });

  it('sends large batches in several requests', async () => {
    const cloud = new FakeCloud();
    await playMatch(25);
    await pushOutbox(cloud, 10);
    const eventCalls = cloud.upsertCalls.filter((c) => c.table === 'events');
    expect(eventCalls.map((c) => c.ids.length)).toEqual([10, 10, 5]);
  });

  it('uploads data entered before sync existed (database upgrade)', async () => {
    const name = 'upgrade-test';
    const { default: Dexie } = await import('dexie');
    const old = new Dexie(name);
    old.version(1).stores({
      players: 'id',
      matches: 'id, matchDate, done',
      sets: 'id, matchId, [matchId+setNumber]',
      events: 'id, matchId, setId, occurredAt',
    });
    await old.table('players').add({ id: 'p1', name: 'Son', jersey: '' });
    await old.table('events').add({ id: 'e1', setId: 's', matchId: 'm', occurredAt: 'x', kind: 'pass', value: 3 });
    old.close();

    const { SideOutDB } = await import('../db/schema');
    const upgraded = new SideOutDB(name);
    const keys = (await upgraded.outbox.toArray()).map((e) => e.key).sort();
    expect(keys).toEqual(['events:e1', 'players:p1']);
    upgraded.close();
  });
});

describe('pull', () => {
  it('brings a second device up to date with the same totals, undo included', async () => {
    const cloud = new FakeCloud();
    const { ids } = await playMatch(4);
    await undoEvent(ids[1]);
    await syncOnce(cloud, 'user-1');
    const first = await loadAppData();

    await wipeLocal(); // "second device"
    await syncOnce(cloud, 'user-1');
    const second = await loadAppData();
    expect(second.events.map((e) => e.id).sort()).toEqual(first.events.map((e) => e.id).sort());
    expect(second.events).toHaveLength(3);
    expect(second.matches[0].opponent).toBe('Ridgeline');
    expect(await db.outbox.count()).toBe(0); // pulling does not queue anything to send back
  });

  it('keeps pass values as numbers', async () => {
    const cloud = new FakeCloud();
    await playMatch(1);
    await syncOnce(cloud, 'u');
    await wipeLocal();
    await syncOnce(cloud, 'u');
    expect((await loadAppData()).events[0].value).toBe(3);
  });

  it('only fetches what changed after the first pull', async () => {
    const cloud = new FakeCloud();
    const { setId } = await playMatch(2);
    await syncOnce(cloud, 'u');
    await addEvent(setId, { kind: 'hit', value: 'kill' });
    await syncOnce(cloud, 'u');
    await syncOnce(cloud, 'u'); // settle: a device's own latest push comes back once
    const seen: number[] = [];
    const fetchChanged = cloud.fetchChanged.bind(cloud);
    cloud.fetchChanged = async (t, since, from, to) => {
      const rows = await fetchChanged(t, since, from, to);
      if (t === 'events') seen.push(rows.length);
      return rows;
    };
    await pullChanges(cloud, 'u');
    expect(seen[0]).toBeLessThanOrEqual(1); // just the newest row, at the bookmark boundary
  });

  it('pages through more rows than one page holds', async () => {
    const cloud = new FakeCloud();
    await playMatch(23);
    await syncOnce(cloud, 'u');
    await wipeLocal();
    await pullChanges(cloud, 'u', 5);
    expect(await db.events.count()).toBe(23);
  });

  it('does not overwrite a local edit that has not been sent yet', async () => {
    const cloud = new FakeCloud();
    const { ids } = await playMatch(1);
    await syncOnce(cloud, 'u');
    // Someone else's copy says the tap is undone...
    cloud.tables.events.set(ids[0], { ...cloud.tables.events.get(ids[0])!, deleted_at: '2026-03-01T00:00:00Z', updated_at: '2030-01-01T00:00:00Z' });
    // ...but locally there is a newer unsent change to the same row.
    await db.events.update(ids[0], { occurredAt: '2026-03-02T00:00:00.000Z' });
    const { queue } = await import('../db/repo');
    await queue('events', ids[0]);
    await pullChanges(cloud, 'u');
    expect((await db.events.get(ids[0]))!.deletedAt ?? null).toBeNull();
  });

  it('folds a pre-sign-in player into the account player and moves its matches', async () => {
    const cloud = new FakeCloud();
    // Device A creates the account data.
    await savePlayer('Maya', '7');
    const accountPlayer = (await db.players.toCollection().first())!;
    await playMatch(1);
    await syncOnce(cloud, 'u');

    // Device B was used before signing in: its own player and match.
    await wipeLocal();
    await startMatch({ opponent: 'Local Only', matchDate: '2026-03-05' });
    const localPlayer = (await db.players.toCollection().first())!;
    expect(localPlayer.id).not.toBe(accountPlayer.id);

    await syncOnce(cloud, 'u');
    const players = await db.players.toArray();
    expect(players.map((p) => p.id)).toEqual([accountPlayer.id]);
    expect(players[0].name).toBe('Maya');
    const matches = await db.matches.toArray();
    expect(matches).toHaveLength(2);
    expect(matches.every((m) => m.playerId === accountPlayer.id)).toBe(true);
    expect(cloud.count('players')).toBe(1);
    expect(cloud.count('matches')).toBe(2);
  });

  it('keeps bookmarks separate per account', async () => {
    const cloud = new FakeCloud();
    await playMatch(1);
    await syncOnce(cloud, 'alice');
    const keys = (await db.meta.toArray()).map((m) => m.key);
    expect(keys.every((k) => k.startsWith('pull:alice:'))).toBe(true);
  });
});
