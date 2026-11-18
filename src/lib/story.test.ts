import { describe, expect, it } from 'vitest';
import { playerStory } from './story';
import type { Match } from './types';

const match: Match = {
  id: 'm',
  map: 'Lockdown',
  day: '2026-02-10',
  players: [
    { id: 'h', bot: false, path: [0, 0, 0, 5000, 300, 400, 9000, 300, 400], h: [400, 420, 410] },
    { id: '7', bot: true, path: [0, 310, 400, 8000, 310, 400], h: [400, 400] },
  ],
  events: [
    [8000, 'killBot', 300, 400, 0, 420],
    [2000, 'loot', 100, 100, 0, 400],
    [8000, 'botDeath', 310, 400, 1, 400],
  ],
  fights: [[8000, 300, 400, 310, 400, 0, 1, 420, 400, 0]],
};

describe('playerStory', () => {
  it('tells a player match: events in order, fights, distance, heights, how it ended', () => {
    const s = playerStory(match, 0, 10_000, 1000);
    expect(s.events.map((e) => e.type)).toEqual(['loot', 'killBot']);
    expect(s.fights).toEqual([{ t: 8000, role: 'killer', other: 1, otherBot: true, meters: 1, inferred: false }]);
    expect(s.meters).toBeCloseTo(50); // 500 UV units on a 1000 m map
    expect([s.heightMin, s.heightMax]).toEqual([40, 42]);
    expect(s.end).toBe('Survived (no death logged)');
    expect(s.opponents).toEqual([1]);
    expect(s.pvpMissing).toBe(false);
  });

  it('flags a player-vs-player event whose other player is not in the data', () => {
    const pvp: Match = { ...match, events: [...match.events, [9000, 'killPlayer', 300, 400, 0, 410]] };
    expect(playerStory(pvp, 0, 10_000, 1000).pvpMissing).toBe(true);
  });

  it('a bot that died: its end is its death, and it is the victim of the fight', () => {
    const s = playerStory(match, 1, 10_000, 1000);
    expect(s.end).toBe('died');
    expect(s.fights[0].role).toBe('victim');
  });
});
