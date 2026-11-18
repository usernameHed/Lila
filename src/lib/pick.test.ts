import { describe, expect, it } from 'vitest';
import { pickEvent, pickGroup, pickPlayer, segmentDistance } from './pick';
import type { Match } from './types';

const match: Match = {
  id: 'm1',
  map: 'Lockdown',
  day: '2026-02-10',
  events: [],
  fights: [],
  players: [
    { id: 'bot', bot: true, path: [0, 0, 0, 1000, 100, 0], h: [0, 0] },
    { id: 'human', bot: false, path: [0, 0, 50, 1000, 100, 50, 2000, 200, 50], h: [0, 0, 0] },
  ],
};

describe('picking', () => {
  it('measures distance to a segment, clamped at its ends', () => {
    expect(segmentDistance(50, 10, 0, 0, 100, 0)).toBe(10);
    expect(segmentDistance(-30, 40, 0, 0, 100, 0)).toBe(50);
  });

  it('finds the nearest path within tolerance, only the part drawn so far', () => {
    expect(pickPlayer([match], 2000, 150, 48, 5)).toEqual({ match: 'm1', player: 1 });
    expect(pickPlayer([match], 2000, 50, 2, 5)).toEqual({ match: 'm1', player: 0 });
    expect(pickPlayer([match], 1000, 180, 50, 5)).toBeNull(); // that part of the path is still in the future
    expect(pickPlayer([match], 2000, 50, 25, 5)).toBeNull();
  });
});

describe('pickEvent', () => {
  const m: Match = { ...match, events: [[500, 'loot', 100, 50, 1, 0], [1500, 'killBot', 200, 50, 1, 0]] };
  it('finds the nearest shown event, skipping future and hidden ones', () => {
    expect(pickEvent([m], 2000, 102, 50, 5, new Set())?.event).toBe(m.events[0]);
    expect(pickEvent([m], 1000, 199, 50, 5, new Set())).toBeNull(); // not happened yet
    expect(pickEvent([m], 2000, 102, 50, 5, new Set(['loot']))).toBeNull();
  });
});

describe('picking a group of icons', () => {
  // Three loot pickups close together and a kill far away, on a 1000 px map (uvUnits 10,000: 10 units = 1 px).
  const events: Match['events'] = [
    [100, 'loot', 4700, 5100, 1, 0],
    [200, 'loot', 4750, 5120, 1, 0],
    [300, 'loot', 4730, 5060, 1, 0],
    [400, 'killBot', 9000, 9000, 1, 0],
  ];
  const m: Match = { ...match, events };
  const at = (u: number, v: number) => ({ u, v, size: 1000 });

  it('picks the group as drawn, with all its members, not one icon inside it', () => {
    const g = pickGroup([m], 1000, at(4730, 5100), 10_000, new Set(), 18, 1);
    expect(g?.items).toHaveLength(3);
  });

  it('splits the group when grouping is off, and skips hidden kinds and future events', () => {
    expect(pickGroup([m], 1000, at(4700, 5100), 10_000, new Set(), 0, 1)?.items).toEqual([events[0]]);
    expect(pickGroup([m], 1000, at(4730, 5100), 10_000, new Set(['loot']), 18, 1)).toBeNull();
    expect(pickGroup([m], 150, at(4730, 5100), 10_000, new Set(), 18, 1)?.items).toEqual([events[0]]);
  });
});
