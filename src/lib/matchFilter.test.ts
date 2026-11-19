import { describe, expect, it } from 'vitest';
import { NO_FILTER, applyFilter, endedOf, lengthOf } from './matchFilter';
import type { MatchSummary } from './types';

const m = (id: string, min: number, events: MatchSummary['events'], extra: Partial<MatchSummary> = {}): MatchSummary => ({
  id, map: 'Lockdown', day: '2026-02-10', durationMs: min * 60_000, humans: 1, bots: 0, rows: 1, fights: 0, onlyMatch: false, events, ...extra,
});
const list = [
  m('a', 3, { killBot: 2, loot: 9 }),
  m('b', 12, { diedToBot: 1, storm: 1, loot: 30 }, { bots: 6 }),
  m('c', 7, { diedToBot: 1, killBot: 5 }, { onlyMatch: true }),
];

describe('match filters', () => {
  it('names how a match ended and how long it was', () => {
    expect(list.map(endedOf)).toEqual(['survived', 'storm', 'bot']);
    expect(list.map(lengthOf)).toEqual(['short', 'long', 'mid']);
  });

  it('filters by outcome and length', () => {
    const ids = (f: Partial<typeof NO_FILTER>) => applyFilter(list, { ...NO_FILTER, ...f }).map((x) => x.id);
    expect(ids({})).toEqual(['a', 'b', 'c']);
    expect(ids({ ended: 'bot' })).toEqual(['c']);
    expect(ids({ length: 'long' })).toEqual(['b']);
  });

  it('sorts by length, kills or loot', () => {
    const ids = (sort: typeof NO_FILTER.sort) => applyFilter(list, { ...NO_FILTER, sort }).map((x) => x.id);
    expect(ids('longest')).toEqual(['b', 'c', 'a']);
    expect(ids('shortest')).toEqual(['a', 'c', 'b']);
    expect(ids('kills')).toEqual(['c', 'a', 'b']);
    expect(ids('loot')).toEqual(['b', 'a', 'c']);
  });
});
