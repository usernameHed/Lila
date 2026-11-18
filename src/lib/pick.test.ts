import { describe, expect, it } from 'vitest';
import { pickPlayer, segmentDistance } from './pick';
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
