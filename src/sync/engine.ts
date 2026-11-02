import { db, SYNC_TABLES, type SyncTable } from '../db/schema';
import { queue } from '../db/repo';
import {
  eventFromCloud,
  eventToCloud,
  matchFromCloud,
  matchToCloud,
  playerFromCloud,
  playerToCloud,
  setFromCloud,
  setToCloud,
  type CloudRow,
} from './mapping';

/** The two things the sync needs from the server. Tests swap in a fake; the app uses Supabase. */
export interface Cloud {
  /** Insert or update by id. Sending the same row twice must be harmless. */
  upsert(table: SyncTable, rows: CloudRow[]): Promise<void>;
  /** Rows changed at or after `since` (null = everything), oldest change first. Inclusive range. */
  fetchChanged(table: SyncTable, since: string | null, from: number, to: number): Promise<CloudRow[]>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CONVERT: Record<SyncTable, { to: (row: any) => CloudRow; from: (row: CloudRow) => unknown }> = {
  players: { to: playerToCloud, from: playerFromCloud },
  matches: { to: matchToCloud, from: matchFromCloud },
  sets: { to: setToCloud, from: setFromCloud },
  events: { to: eventToCloud, from: eventFromCloud },
};

/**
 * Send everything in the outbox. Parents go first (players, matches, sets, then events) so the
 * server's foreign keys are satisfied. An entry is cleared only after the server accepted it,
 * and only if the row was not edited again meanwhile. If anything throws, what is left stays
 * queued, and sending it again later is safe because every send is an upsert by id.
 */
export async function pushOutbox(cloud: Cloud, batchSize = 200): Promise<number> {
  const entries = await db.outbox.toArray();
  let sent = 0;
  for (const table of SYNC_TABLES) {
    const mine = entries.filter((e) => e.table === table);
    for (let i = 0; i < mine.length; i += batchSize) {
      const chunk = mine.slice(i, i + batchSize);
      const found = await db.table(table).bulkGet(chunk.map((e) => e.rowId));
      const rows = found.filter((r) => r !== undefined);
      if (rows.length) await cloud.upsert(table, rows.map(CONVERT[table].to));
      await db.transaction('rw', db.outbox, async () => {
        for (const e of chunk) {
          const current = await db.outbox.get(e.key);
          if (current?.stamp === e.stamp) await db.outbox.delete(e.key);
        }
      });
      sent += rows.length;
    }
  }
  return sent;
}

/**
 * A device used before signing in has its own player row. When the account already has a
 * player, fold the local one into it so there is a single player and the matches follow.
 * Only a player that never reached the cloud is merged; one that did is a real second player.
 */
async function adoptCloudPlayer(cloudId: string): Promise<void> {
  const others = await db.players.filter((p) => p.id !== cloudId).toArray();
  for (const local of others) {
    if (!(await db.outbox.get(`players:${local.id}`))) continue;
    const matchIds = await db.matches.filter((m) => m.playerId === local.id).primaryKeys();
    for (const id of matchIds) await db.matches.update(id, { playerId: cloudId });
    if (matchIds.length) await queue('matches', ...matchIds);
    await db.players.delete(local.id);
    await db.outbox.delete(`players:${local.id}`);
  }
}

/** Save fetched rows locally, except rows with edits still waiting to be sent: those win. */
async function applyRows(table: SyncTable, rows: CloudRow[]): Promise<number> {
  if (!rows.length) return 0;
  let applied = 0;
  await db.transaction('rw', [db.players, db.matches, db.sets, db.events, db.outbox], async () => {
    const pending = new Set(await db.outbox.where('table').equals(table).primaryKeys());
    for (const row of rows) {
      const id = row.id as string;
      if (pending.has(`${table}:${id}`)) continue;
      if (table === 'players') await adoptCloudPlayer(id);
      await db.table(table).put(CONVERT[table].from(row));
      applied++;
    }
  });
  return applied;
}

/**
 * Bring down what changed in the cloud since last time. The bookmark is saved only after every
 * page was applied, so an interrupted pull simply starts that table over. `scope` (the signed-in
 * user's id) keeps one account's bookmarks from being used by another.
 */
export async function pullChanges(cloud: Cloud, scope: string, pageSize = 500): Promise<number> {
  let applied = 0;
  for (const table of SYNC_TABLES) {
    const cursorKey = `pull:${scope}:${table}`;
    const since = (await db.meta.get(cursorKey))?.value ?? null;
    let newest = since;
    for (let offset = 0; ; offset += pageSize) {
      const rows = await cloud.fetchChanged(table, since, offset, offset + pageSize - 1);
      applied += await applyRows(table, rows);
      if (rows.length) newest = rows[rows.length - 1].updated_at as string;
      if (rows.length < pageSize) break;
    }
    if (newest && newest !== since) await db.meta.put({ key: cursorKey, value: newest });
  }
  return applied;
}

/** One full round: pull first (so a fresh device adopts the account's player), then push. */
export async function syncOnce(cloud: Cloud, scope: string): Promise<{ pulled: number; pushed: number }> {
  const pulled = await pullChanges(cloud, scope);
  const pushed = await pushOutbox(cloud);
  return { pulled, pushed };
}
