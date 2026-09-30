import type { CupResult } from './cup';
import type { DailyChallenge } from './daily';
import type { SquadResult } from './leaderboard';
import type { League } from './leagues';
import { seasonLabel } from './clubs';
import { LEAGUE_NAMES } from './leagues';
import { matchEvents, simulateMatch, type MatchEvent, type MatchResult, type MatchSide, type SquadInsight } from './match';
import type { SeasonResult } from './season';

/**
 * Tournaments are played on the server (POST /api/squads/:id/play): the app sends its choice, the
 * server builds your side from the saved squad (players checked against the database), simulates
 * with its own random numbers, stores the result on the squad and returns everything the app needs
 * to show it. A squad plays one tournament, plus one more per Second chance.
 */

/** One match from your point of view (the engine's home side is `youAtHome ? you : them`). */
export type PlayedMatch = {
  youAtHome: boolean;
  /** Final on neutral ground: no home advantage (you are the engine's "home" side). */
  neutral?: boolean;
  opponentName: string;
  result: MatchResult;
  /** Goals with assists, yellow and red cards, by minute. */
  events: MatchEvent[];
};

/** Plays you against `them`: random venue (or neutral), goals, cards. */
export function playMatch(
  you: MatchSide,
  them: MatchSide,
  venue: 'random' | 'neutral' = 'random',
  random: () => number = Math.random,
): PlayedMatch {
  const neutral = venue === 'neutral';
  const youAtHome = neutral || random() < 0.5;
  const [home, away] = youAtHome ? [you, them] : [them, you];
  const result = simulateMatch(home, away, random, { neutral });
  return { youAtHome, neutral, opponentName: them.name, result, events: matchEvents(home, away, result, random) };
}

/** Goals for you and against, from a played match. */
export function scoreOf(p: PlayedMatch) {
  const yours = p.youAtHome ? p.result.homeGoals : p.result.awayGoals;
  const theirs = p.youAtHome ? p.result.awayGoals : p.result.homeGoals;
  return { yours, theirs, outcome: (yours > theirs ? 'win' : yours === theirs ? 'draw' : 'loss') as 'win' | 'draw' | 'loss' };
}

// ---- Legends: a two-legged tie (you host the first leg), penalties if level on aggregate.

const PENALTY_SCORED = 0.76;

export type LegendLeg = { youAtHome: boolean; result: MatchResult; events: MatchEvent[]; yours: number; theirs: number };
export type LegendTie = {
  legs: [LegendLeg, LegendLeg];
  aggYours: number;
  aggTheirs: number;
  penalties: { yours: number; theirs: number } | null;
  won: boolean;
};

function shootout(random: () => number) {
  let yours = 0;
  let theirs = 0;
  for (let k = 0; k < 5; k++) {
    if (random() < PENALTY_SCORED) yours++;
    if (random() < PENALTY_SCORED) theirs++;
  }
  while (yours === theirs) {
    const a = random() < PENALTY_SCORED;
    const b = random() < PENALTY_SCORED;
    if (a) yours++;
    if (b) theirs++;
  }
  return { yours, theirs };
}

export function playLegendTie(you: MatchSide, them: MatchSide, random: () => number = Math.random): LegendTie {
  const leg = (youAtHome: boolean): LegendLeg => {
    const [home, away] = youAtHome ? [you, them] : [them, you];
    const result = simulateMatch(home, away, random);
    const yours = youAtHome ? result.homeGoals : result.awayGoals;
    const theirs = youAtHome ? result.awayGoals : result.homeGoals;
    return { youAtHome, result, events: matchEvents(home, away, result, random), yours, theirs };
  };
  const legs: [LegendLeg, LegendLeg] = [leg(true), leg(false)];
  const aggYours = legs[0].yours + legs[1].yours;
  const aggTheirs = legs[0].theirs + legs[1].theirs;
  const penalties = aggYours === aggTheirs ? shootout(random) : null;
  return { legs, aggYours, aggTheirs, penalties, won: penalties ? penalties.yours > penalties.theirs : aggYours > aggTheirs };
}

// ---- Requests and responses

export type PlayRequest = {
  userId: string;
  /** Your club name (shown instead of "Your XI"). */
  teamName: string;
} & (
  | { mode: 'match'; league: League; season: number; clubSlug: string }
  | { mode: 'challenge'; opponentSquadId: string }
  | { mode: 'legend'; legendId: string; /** One match, or a two-legged tie (default). */ format?: 'single' | 'tie' }
  | { mode: 'league'; league: League; season: number }
  | { mode: 'cup'; season: number }
  | { mode: 'daily'; date: string }
);

/** What the app chooses (the user and club name are added when sending). */
export type PlayChoice = PlayRequest extends infer R ? (R extends PlayRequest ? Omit<R, 'userId' | 'teamName'> : never) : never;

export type PlayResponse =
  | { mode: 'match' | 'challenge'; played: PlayedMatch; report: SquadResult }
  | { mode: 'legend'; tie: LegendTie | null; played: PlayedMatch | null; report: SquadResult }
  | {
      mode: 'league';
      result: SeasonResult;
      /** Every club with its average XI rating (yours as YOUR_ID). */
      teams: { id: string; name: string; rating: number | null }[];
      replaced: string;
      insight: SquadInsight;
      bench: number;
      report: SquadResult;
    }
  | {
      mode: 'cup';
      result: CupResult;
      teams: { id: string; name: string; league: League | null; elo: number | null }[];
      insight: SquadInsight;
      report: SquadResult;
    }
  | {
      mode: 'daily';
      challenge: DailyChallenge;
      /** The legend match, if the challenge has one. */
      played: PlayedMatch | null;
      checks: { label: string; ok: boolean }[];
      success: boolean;
      score: number;
      /** false: this day already had a result (the first one counts, shown again). */
      counted: boolean;
      leagues: number;
      report: SquadResult;
    };

/** POST /api/squads/:id/second-chance – uses a Second chance: this squad may play one more tournament. */
export type SecondChanceResponse = { ok: boolean; plays: number; allowed: number; reason?: string };

// ---- Result lines for the leaderboard (built on the server)

export const YOUR_ID = '__you__';

const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th');
  return `${n}${s}`;
};

export function matchReport(played: PlayedMatch, title: string): SquadResult {
  const { yours, theirs, outcome } = scoreOf(played);
  return {
    mode: 'match',
    title,
    detail: `${yours}–${theirs} ${played.neutral ? '(neutral)' : played.youAtHome ? '(home)' : '(away)'}`,
    outcome,
  };
}

export function legendReport(tie: LegendTie, title: string): SquadResult {
  return {
    mode: 'legend',
    title,
    detail: `${tie.aggYours}–${tie.aggTheirs} agg.${tie.penalties ? ` · pens ${tie.penalties.yours}–${tie.penalties.theirs}` : ''}`,
    outcome: tie.won ? 'win' : 'loss',
  };
}

export function leagueReport(result: SeasonResult, league: League, season: number): SquadResult {
  const row = result.table.find((r) => r.id === YOUR_ID)!;
  const clubs = result.table.length;
  return {
    mode: 'league',
    title: `${LEAGUE_NAMES[league].split(' / ')[0]} ${seasonLabel(season)}`,
    detail: `${ordinal(row.position)} · ${row.won}-${row.drawn}-${row.lost} · ${row.points} pts`,
    outcome: row.position === 1 ? 'champion' : row.position <= 4 ? 'top' : row.position <= clubs / 2 ? 'mid' : 'out',
  };
}

export function cupReport(result: CupResult, season: number): SquadResult {
  const champion = result.championId === YOUR_ID;
  const last = [...result.rounds].reverse().find((x) => x.ties.some((t) => t.a === YOUR_ID || t.b === YOUR_ID));
  return {
    mode: 'cup',
    title: `Champions League ${seasonLabel(season)}`,
    detail: champion ? 'Winners' : last ? (last.name === 'Final' ? 'Runner-up' : `Out: ${last.name}`) : 'Group stage exit',
    outcome: champion ? 'champion' : last?.name === 'Final' || last?.name === 'Semi-finals' ? 'top' : last ? 'mid' : 'out',
  };
}
