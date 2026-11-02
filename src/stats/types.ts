export type PassValue = 0 | 1 | 2 | 3;
export type ServeValue = 'ace' | 'in' | 'error';
export type HitValue = 'kill' | 'in' | 'error';

interface BaseEvent {
  /** Client-generated UUID. */
  id: string;
  setId: string;
  matchId: string;
  /** ISO timestamp. */
  occurredAt: string;
  /** Set when the event was undone. Undone events never count. */
  deletedAt?: string | null;
}

export interface PassEvent extends BaseEvent {
  kind: 'pass';
  value: PassValue;
}

export interface ServeEvent extends BaseEvent {
  kind: 'serve';
  value: ServeValue;
}

export interface HitEvent extends BaseEvent {
  kind: 'hit';
  value: HitValue;
}

export type StatEvent = PassEvent | ServeEvent | HitEvent;
