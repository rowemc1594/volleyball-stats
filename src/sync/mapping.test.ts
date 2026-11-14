import { describe, expect, it } from 'vitest';
import type { StatEvent } from '../stats/types';
import { eventFromCloud, eventToCloud } from './mapping';

const base = { id: 'e1', matchId: 'm1', setId: 's1', occurredAt: '2026-03-07T19:00:00.000Z', deletedAt: null };

describe('event mapping for the cloud', () => {
  const samples: StatEvent[] = [
    { ...base, kind: 'pass', value: 2 },
    { ...base, kind: 'serve', value: 'ace' },
    { ...base, kind: 'hit', value: 'kill' },
    { ...base, kind: 'block', value: 'block' },
    { ...base, kind: 'block', value: 'touch' },
    { ...base, kind: 'block', value: 'error_net' },
    { ...base, kind: 'block', value: 'error_under' },
    { ...base, kind: 'setting', value: 0 },
    { ...base, kind: 'setting', value: 3 },
  ];

  it.each(samples)('round-trips $kind $value unchanged', (e) => {
    expect(eventFromCloud(eventToCloud(e))).toEqual(e);
  });

  it('sends setting values as text, like pass values, and reads them back as numbers', () => {
    const row = eventToCloud({ ...base, kind: 'setting', value: 3 });
    expect(row.kind).toBe('setting');
    expect(row.value).toBe('3');
    const back = eventFromCloud({ ...row, occurred_at: base.occurredAt });
    expect(back.value).toBe(3);
  });

  it('keeps the two block error types distinct', () => {
    expect(eventToCloud({ ...base, kind: 'block', value: 'error_net' }).value).toBe('error_net');
    expect(eventToCloud({ ...base, kind: 'block', value: 'error_under' }).value).toBe('error_under');
  });
});
