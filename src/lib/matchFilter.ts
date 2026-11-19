// Which matches the list shows, and in what order: the filters of the "Matches" section.
import type { MatchSummary } from './types';

export type Ended = 'any' | 'survived' | 'bot' | 'storm' | 'player';
export type Length = 'any' | 'short' | 'mid' | 'long';
export type SortBy = 'day' | 'longest' | 'shortest' | 'kills' | 'loot';
/** Who else is in the game: bots recorded too (their paths are in the data), or a player fought. */
export type Game = 'any' | 'bots' | 'pvp';

export interface MatchFilter {
  ended: Ended;
  length: Length;
  game: Game;
  sort: SortBy;
}

export const NO_FILTER: MatchFilter = { ended: 'any', length: 'any', game: 'any', sort: 'day' };

/** Bots recorded in the match (52 of 796), or a fight with another player (a kill or a death). */
export const gameOf = (m: MatchSummary, g: Exclude<Game, 'any'>): boolean =>
  g === 'bots' ? m.bots > 0 : !!(m.events.killPlayer || m.events.diedToPlayer);

/** How the human's match ended. No death logged = survived (extraction is not logged). */
export function endedOf(m: MatchSummary): Exclude<Ended, 'any'> {
  const e = m.events;
  if (e.storm) return 'storm';
  if (e.diedToPlayer) return 'player';
  if (e.diedToBot) return 'bot';
  return 'survived';
}

const MIN = 60_000;
export const lengthOf = (m: MatchSummary): Exclude<Length, 'any'> =>
  m.durationMs < 5 * MIN ? 'short' : m.durationMs < 10 * MIN ? 'mid' : 'long';

const kills = (m: MatchSummary) => (m.events.killBot ?? 0) + (m.events.killPlayer ?? 0);

/** The matches kept by the filter, sorted. 'day' keeps the data's order (by day, then id). */
export function applyFilter(list: MatchSummary[], f: MatchFilter): MatchSummary[] {
  const kept = list.filter(
    (m) =>
      (f.ended === 'any' || endedOf(m) === f.ended) &&
      (f.length === 'any' || lengthOf(m) === f.length) &&
      (f.game === 'any' || gameOf(m, f.game)),
  );
  const by: Record<SortBy, ((a: MatchSummary, b: MatchSummary) => number) | null> = {
    day: null,
    longest: (a, b) => b.durationMs - a.durationMs,
    shortest: (a, b) => a.durationMs - b.durationMs,
    kills: (a, b) => kills(b) - kills(a),
    loot: (a, b) => (b.events.loot ?? 0) - (a.events.loot ?? 0),
  };
  const cmp = by[f.sort];
  return cmp ? [...kept].sort(cmp) : kept;
}
