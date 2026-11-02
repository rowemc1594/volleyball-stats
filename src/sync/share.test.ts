import { describe, expect, it } from 'vitest';
import { parseHash } from '../router';
import { eventsForMatch, summarize } from '../stats/engine';
import { newShareToken, parseSharedStats, shareUrl } from './share';

describe('share token', () => {
  it('is long, URL-safe and different every time', () => {
    const tokens = Array.from({ length: 200 }, newShareToken);
    expect(new Set(tokens).size).toBe(200);
    for (const t of tokens) {
      expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes = 256 bits
    }
  });
});

describe('share url', () => {
  it('puts the secret after the # so servers never see it', () => {
    const url = shareUrl('abc_DEF-123', 'https://rowemc1594.github.io/volleyball-stats/');
    expect(url).toBe('https://rowemc1594.github.io/volleyball-stats/#/share/abc_DEF-123');
    expect(new URL(url).search).toBe('');
    expect(new URL(url).pathname).toBe('/volleyball-stats/');
  });

  it('round-trips through the router', () => {
    const token = newShareToken();
    const hash = new URL(shareUrl(token, 'https://x.test/volleyball-stats')).hash;
    expect(parseHash(hash)).toEqual({ name: 'share', token });
  });

  it('a bare /share with no token is just the home screen', () => {
    expect(parseHash('#/share')).toEqual({ name: 'matches' });
  });
});

describe('parseSharedStats', () => {
  const payload = {
    player: { id: 'p1', name: 'Maya', jersey: '7' },
    matches: [
      { id: 'm1', player_id: 'p1', opponent: 'Ridgeline', match_date: '2026-03-01', event: '', done: true, created_at: '2026-03-01T18:00:00+00:00', deleted_at: null },
      { id: 'm2', player_id: 'p1', opponent: 'Hawks', match_date: '2026-03-08', event: 'League', done: false, created_at: '2026-03-08T18:00:00+00:00' },
    ],
    sets: [
      { id: 's2', match_id: 'm1', set_number: 2, score_us: 21, score_them: 25 },
      { id: 's1', match_id: 'm1', set_number: 1, score_us: 25, score_them: 20 },
    ],
    events: [
      { id: 'e1', match_id: 'm1', set_id: 's1', kind: 'pass', value: '3', occurred_at: '2026-03-01T18:05:00+00:00' },
      { id: 'e2', match_id: 'm1', set_id: 's1', kind: 'pass', value: '1', occurred_at: '2026-03-01T18:06:00+00:00' },
      { id: 'e3', match_id: 'm1', set_id: 's1', kind: 'hit', value: 'kill', occurred_at: '2026-03-01T18:07:00+00:00' },
    ],
  };

  it('turns the server answer into the shapes the screens use', () => {
    const data = parseSharedStats(payload)!;
    expect(data.player).toEqual({ id: 'p1', name: 'Maya', jersey: '7' });
    expect(data.matches.map((m) => m.id)).toEqual(['m2', 'm1']); // newest first
    expect(data.sets.map((s) => s.setNumber)).toEqual([1, 2]);
    expect(data.events[0].value).toBe(3); // pass values are numbers again
    expect(data.matches[1].createdAt).toBe('2026-03-01T18:00:00.000Z');
  });

  it('gives the same totals the owner sees', () => {
    const data = parseSharedStats(payload)!;
    const s = summarize(eventsForMatch(data.events, 'm1'));
    expect(s.pass.average).toBe(2); // (3 + 1) / 2
    expect(s.hit.kill).toBe(1);
  });

  it('treats null (revoked or unknown link) as no data', () => {
    expect(parseSharedStats(null)).toBeNull();
    expect(parseSharedStats(undefined)).toBeNull();
  });

  it('copes with an empty player', () => {
    const data = parseSharedStats({ player: null, matches: [], sets: [], events: [] })!;
    expect(data.player).toBeUndefined();
    expect(data.matches).toEqual([]);
  });
});
