import { describe, expect, it } from 'vitest';
import { BUNDLE_ABOVE, planLoads } from './data';
import type { MatchSummary } from './types';

const summary = (id: string, day: string): MatchSummary => ({
  id, map: 'Lockdown', day, durationMs: 1, humans: 1, bots: 0, rows: 1, events: {},
});

describe('planLoads', () => {
  it('fetches single match files for a few matches', () => {
    const plan = planLoads([summary('a', '2026-02-10'), summary('b', '2026-02-11')]);
    expect(plan).toEqual({ matches: ['/data/matches/a.json', '/data/matches/b.json'], bundles: [] });
  });

  it('fetches one bundle per map and day for many matches', () => {
    const many = Array.from({ length: BUNDLE_ABOVE + 3 }, (_, i) => summary(`m${i}`, i % 2 ? '2026-02-10' : '2026-02-11'));
    expect(planLoads(many)).toEqual({
      matches: [],
      bundles: ['/data/bundles/Lockdown_2026-02-11.json', '/data/bundles/Lockdown_2026-02-10.json'],
    });
  });
});
