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

/** Block: 'block' = blocked down for a point, 'touch' = touched with no point, errors say how it went wrong. */
export type BlockValue = 'block' | 'touch' | 'error_net' | 'error_under';
/** Setting uses its own 0-3 scale: 3 perfect, 2 good, 1 bad but hittable, 0 error. */
export type SettingValue = 0 | 1 | 2 | 3;

export interface BlockEvent extends BaseEvent {
  kind: 'block';
  value: BlockValue;
}

export interface SettingEvent extends BaseEvent {
  kind: 'setting';
  value: SettingValue;
}

export type StatEvent = PassEvent | ServeEvent | HitEvent | BlockEvent | SettingEvent;
