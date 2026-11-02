import type { StatInput } from './db/repo';

export type Colour = 'green' | 'blue' | 'amber' | 'red' | 'gray';

export interface KeyDef {
  input: StatInput;
  big: string;
  title: string;
  sub: string;
  colour: Colour;
}

/** The tap buttons, in the order they appear on the Track screen. */
export const PASS_KEYS: KeyDef[] = [
  { input: { kind: 'pass', value: 3 }, big: '3', title: 'Perfect', sub: 'In-System', colour: 'green' },
  { input: { kind: 'pass', value: 2 }, big: '2', title: 'Playable', sub: 'Off Net', colour: 'blue' },
  { input: { kind: 'pass', value: 1 }, big: '1', title: 'OOS', sub: 'High / Off', colour: 'amber' },
  { input: { kind: 'pass', value: 0 }, big: '0', title: 'Error', sub: 'Ace Agst', colour: 'red' },
];

export const HIT_KEYS: KeyDef[] = [
  { input: { kind: 'hit', value: 'kill' }, big: 'KILL', title: 'Point (+1)', sub: 'Floor / Block-Out', colour: 'green' },
  { input: { kind: 'hit', value: 'in' }, big: 'PLAY', title: 'In-Play', sub: 'Dug / Kept Alive', colour: 'gray' },
  { input: { kind: 'hit', value: 'error' }, big: 'ERR', title: 'Error (−1)', sub: 'Out / Net / Stuffed', colour: 'red' },
];

export const SERVE_KEYS: KeyDef[] = [
  { input: { kind: 'serve', value: 'ace' }, big: 'ACE', title: 'Ace (+1)', sub: 'Untouched / Floor', colour: 'green' },
  { input: { kind: 'serve', value: 'in' }, big: 'IN', title: 'In Play', sub: 'Playable Rally', colour: 'gray' },
  { input: { kind: 'serve', value: 'error' }, big: 'FAULT', title: 'Error (−1)', sub: 'Net / Long / Line', colour: 'red' },
];

export function colourOf(kind: StatInput['kind'], value: StatInput['value']): Colour {
  const all = [...PASS_KEYS, ...HIT_KEYS, ...SERVE_KEYS];
  return all.find((k) => k.input.kind === kind && k.input.value === value)?.colour ?? 'gray';
}
