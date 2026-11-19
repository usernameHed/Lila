// Which matches the list shows, and in what order: the filters of the "Matches" section.
import type { MatchSummary } from './types';

export type Ended = 'any' | 'survived' | 'bot' | 'storm' | 'player';
export type Length = 'any' | 'short' | 'mid' | 'long';
export type SortBy = 'day' | 'longest' | 'shortest' | 'kills' | 'loot';
/**
 * Who is recorded in the match. Every match has its human player (2 in two matches); in 52 of 796 the bots were
 * recorded too. 'player': no bot recorded; 'bots': the bots' files too; 'multi': two players recorded.
 */
export type Game = 'any' | 'bots' | 'player' | 'multi';

export interface MatchFilter {
  ended: Ended;
  length: Length;
  game: Game;
  sort: SortBy;
}

export const NO_FILTER: MatchFilter = { ended: 'any', length: 'any', game: 'any', sort: 'day' };

/** Bots recorded in the match too, no bot recorded, or more than one player recorded. */
export const gameOf = (m: MatchSummary, g: Exclude<Game, 'any'>): boolean =>
  g === 'bots' ? m.bots > 0 : g === 'multi' ? m.humans > 1 : m.bots === 0;

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
