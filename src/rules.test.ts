import { describe, expect, it } from 'vitest';
import { parseHash, paths } from './router';
import { filterRules, RULES, rulesByTopic, TOPICS } from './rules';

describe('rules content', () => {
  it('has unique ids and a plain one-line definition for every entry', () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
    for (const r of RULES) {
      expect(r.term.trim()).not.toBe('');
      expect(r.short.trim().length).toBeGreaterThan(15);
      expect(TOPICS).toContain(r.topic);
    }
  });

  it('covers the terms parents asked about', () => {
    const terms = RULES.map((r) => r.term.toLowerCase()).join(' | ');
    for (const t of ['double hit', 'under the net', 'rotation error', 'overlap', 'foot fault', 'back-row attack']) {
      expect(terms).toContain(t);
    }
  });

  it('has every topic used at least once, in the order listed', () => {
    expect(rulesByTopic(RULES).map((g) => g.topic)).toEqual([...TOPICS]);
  });
});

describe('filterRules', () => {
  const ids = (q: string) => filterRules(q).map((r) => r.id);

  it('returns everything for an empty search', () => {
    expect(filterRules('')).toHaveLength(RULES.length);
    expect(filterRules('   ')).toHaveLength(RULES.length);
  });

  it('finds an entry by its name, ignoring case and punctuation', () => {
    expect(ids('DOUBLE hit')).toContain('double-hit');
    expect(ids('double-hit')).toContain('double-hit');
  });

  it('finds an entry by another name people use', () => {
    expect(ids('carry')).toContain('lift');
    expect(ids('net touch')).toContain('net-touch');
    expect(ids('out of rotation')).toContain('rotation-error');
    expect(ids('center line')).toContain('under-net');
  });

  it('requires every word to match, so more words narrow the result', () => {
    expect(filterRules('serve').length).toBeGreaterThan(filterRules('serve foot').length);
    expect(ids('serve foot')).toContain('foot-fault');
  });

  it('returns nothing for nonsense', () => {
    expect(filterRules('zzzxq')).toEqual([]);
  });

  it('keeps the original list untouched', () => {
    const before = RULES.length;
    filterRules('block');
    expect(RULES).toHaveLength(before);
  });
});

describe('rules route', () => {
  it('parses #/rules and has a path for the link', () => {
    expect(parseHash('#/rules')).toEqual({ name: 'rules' });
    expect(paths.rules).toBe('#/rules');
  });
});
