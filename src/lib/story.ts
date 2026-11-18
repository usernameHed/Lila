// One player's match, summed up for the details card: what happened, when, against whom.
import { EVENT_STYLE } from './style';
import type { EventType, Match, MatchEvent } from './types';

export interface StoryEvent {
  ref: MatchEvent; // the event itself, to link the card with the map and the timeline
  t: number;
  type: EventType;
  label: string;
}

export interface StoryFight {
  t: number;
  role: 'killer' | 'victim';
  other: number; // index of the other player in match.players
  otherBot: boolean;
  meters: number;
  inferred: boolean;
}

export interface Story {
  id: string;
  bot: boolean;
  events: StoryEvent[];
  fights: StoryFight[];
  firstMs: number;
  lastMs: number;
  meters: number; // distance walked (sum of sample-to-sample segments)
  heightMin: number; // meters
  heightMax: number;
  end: string; // how it ended
  /** The other side of each fight with this player (indexes in match.players), for their paths to show too. */
  opponents: number[];
  /** A player-vs-player kill or death whose other player is not in the data (their file is missing). */
  pvpMissing: boolean;
}

const DEATHS: EventType[] = ['diedToBot', 'diedToPlayer', 'storm', 'botDeath'];

export function playerStory(match: Match, index: number, uvUnits: number, mapScale: number): Story {
  const p = match.players[index];
  const toM = (d: number) => (d / uvUnits) * mapScale;
  let meters = 0;
  for (let i = 3; i < p.path.length; i += 3) meters += toM(Math.hypot(p.path[i + 1] - p.path[i - 2], p.path[i + 2] - p.path[i - 1]));
  const events = match.events
    .filter((e) => e[4] === index)
    .map((e) => ({ ref: e, t: e[0], type: e[1], label: EVENT_STYLE[e[1]].label }))
    .sort((a, b) => a.t - b.t);
  const fights: StoryFight[] = (match.fights ?? [])
    .filter((f) => f[5] === index || f[6] === index)
    .map((f) => {
      const role = f[5] === index ? 'killer' : 'victim';
      const other = role === 'killer' ? f[6] : f[5];
      return { t: f[0], role, other, otherBot: match.players[other]?.bot ?? false, meters: toM(Math.hypot(f[1] - f[3], f[2] - f[4])), inferred: !!f[9] } as StoryFight;
    });
  const death = events.find((e) => DEATHS.includes(e.type));
  const pvp = events.filter((e) => e.type === 'killPlayer' || e.type === 'diedToPlayer');
  const pvpMissing = pvp.some((e) => !fights.some((f) => f.t === e.t && !f.otherBot));
  const hs = p.h?.length ? p.h : [0];
  return {
    id: p.id,
    bot: p.bot,
    events,
    fights,
    firstMs: p.path[0] ?? 0,
    lastMs: p.path[p.path.length - 3] ?? 0,
    meters,
    heightMin: Math.min(...hs) / 10,
    heightMax: Math.max(...hs) / 10,
    end: death ? (death.type === 'botDeath' ? 'died' : death.label.replace(/^(Player|Bot) /, '')) : p.bot ? 'Still alive when its log ends' : 'Survived (no death logged)',
    opponents: [...new Set(fights.map((f) => f.other))],
    pvpMissing,
  };
}
