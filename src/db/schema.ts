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

/** Local IndexedDB database. The UI reads from here only; the network is never in the tap path. */
export class SideOutDB extends Dexie {
  players!: EntityTable<Player, 'id'>;
  matches!: EntityTable<Match, 'id'>;
  sets!: EntityTable<SetRow, 'id'>;
  events!: EntityTable<StatEvent, 'id'>;

  constructor(name = 'side-out-stats') {
    super(name);
    this.version(1).stores({
      players: 'id',
      matches: 'id, matchDate, done',
      sets: 'id, matchId, [matchId+setNumber]',
      events: 'id, matchId, setId, occurredAt',
    });
  }
}

export const db = new SideOutDB();
