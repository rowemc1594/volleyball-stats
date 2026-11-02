import Dexie, { type EntityTable } from 'dexie';
import type { StatEvent } from '../stats/types';

export interface Player {
  id: string;
  name: string;
  jersey: string;
}

export interface Match {
  id: string;
  playerId: string;
  opponent: string;
  /** Local calendar date, YYYY-MM-DD. */
  matchDate: string;
  event: string;
  /** True once the match is marked Final. */
  done: boolean;
  createdAt: string;
  /** Soft delete, so a later sync can tell the cloud copy to go too. */
  deletedAt?: string | null;
}

export interface SetRow {
  id: string;
  matchId: string;
  setNumber: number;
  scoreUs: number | null;
  scoreThem: number | null;
}

/** Tables that sync to the cloud, in the order they must be sent (parents before children). */
export const SYNC_TABLES = ['players', 'matches', 'sets', 'events'] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

/**
 * "This row changed and the cloud has not seen it yet." One entry per row (the key), so ten
 * edits to one row are sent once. The stamp changes on every edit, so a sync that finishes
 * while a newer edit landed does not throw that edit away.
 */
export interface OutboxEntry {
  key: string;
  table: SyncTable;
  rowId: string;
  stamp: string;
}

/** Small settings that must live and die with the local data (for example sync cursors). */
export interface MetaRow {
  key: string;
  value: string;
}

/** Local IndexedDB database. The UI reads from here only; the network is never in the tap path. */
export class SideOutDB extends Dexie {
  players!: EntityTable<Player, 'id'>;
  matches!: EntityTable<Match, 'id'>;
  sets!: EntityTable<SetRow, 'id'>;
  events!: EntityTable<StatEvent, 'id'>;
  outbox!: EntityTable<OutboxEntry, 'key'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = 'side-out-stats') {
    super(name);
    this.version(1).stores({
      players: 'id',
      matches: 'id, matchDate, done',
      sets: 'id, matchId, [matchId+setNumber]',
      events: 'id, matchId, setId, occurredAt',
    });
    this.version(2)
      .stores({ outbox: 'key, table', meta: 'key' })
      .upgrade(async (tx) => {
        // Everything entered before cloud sync existed still needs to be uploaded once.
        for (const table of SYNC_TABLES) {
          const ids = (await tx.table(table).toCollection().primaryKeys()) as string[];
          await tx.table('outbox').bulkPut(
            ids.map((rowId) => ({ key: `${table}:${rowId}`, table, rowId, stamp: crypto.randomUUID() })),
          );
        }
      });
  }
}

export const db = new SideOutDB();
