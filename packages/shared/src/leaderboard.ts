import { CHEMISTRY } from './chemistry';
import type { PlayerRole } from './formation-layout';
import type { MatchSide } from './match';

/**
 * Online leaderboard: a player saves a drafted squad under a generated username; anyone can
 * browse the highest-overall squads, open one and see what it achieved.
 */

/** POST /api/users – a new player: a secret id (kept on the device) and a public username. */
export type UserResponse = { userId: string; username: string };

export type SavedPlayer = {
  /** Detailed position of his spot (e.g. "CB"); players are in formation spot order. */
  spot: string;
  role: PlayerRole;
  name: string;
  rating: number | null;
  club: string;
  decade: string;
  league: string;
};

/** What a squad achieved with its one tournament. */
export type SquadResult = {
  mode: 'match' | 'league' | 'cup' | 'legend' | 'daily' | 'h2h';
  title: string;
  detail: string;
  outcome: 'win' | 'draw' | 'loss' | 'champion' | 'top' | 'mid' | 'out';
  at?: string;
};

export type SaveSquadRequest = {
  userId: string;
  formation: string;
  overall: number;
  rating: number;
  chemistry: number;
  players: SavedPlayer[];
};

/** GET /api/squads – leaderboard row (highest overall first). */
export type LeaderboardEntry = {
  id: string;
  username: string;
  formation: string;
  overall: number;
  chemistry: number;
  /** Latest result (null = not played yet). */
  result: SquadResult | null;
  createdAt: string;
};

export type LeaderboardResponse = { squads: LeaderboardEntry[] };

/** GET /api/squads/:id – everything about a saved squad (anyone can look). */
export type SquadDetail = LeaderboardEntry & { rating: number; players: SavedPlayer[]; results: SquadResult[] };

/** A saved squad as a match side ("Challenge this XI"): its players, its chemistry as the factor. */
export function savedSquadSide(s: Pick<SquadDetail, 'username' | 'players' | 'chemistry'>): MatchSide {
  return {
    name: `@${s.username}`,
    xi: s.players.map((p) => ({ name: p.name, position: p.role, rating: p.rating })),
    factor: CHEMISTRY.minFactor + (CHEMISTRY.factorRange * s.chemistry) / 100,
  };
}

// ---- Username generator (server side)

const ADJECTIVES = [
  'Golden',
  'Silent',
  'Iron',
  'Flying',
  'Clinical',
  'Total',
  'Tiki',
  'Wild',
  'Royal',
  'Rapid',
  'Lucky',
  'Magic',
  'Stone',
  'Late',
  'Sweeping',
  'Crafty',
  'Galactic',
  'Invincible',
  'Brave',
  'Cool',
  'Fearless',
  'Mighty',
  'Sharp',
];
const NOUNS = [
  'Libero',
  'Regista',
  'Trequartista',
  'Poacher',
  'Keeper',
  'Winger',
  'Playmaker',
  'Stopper',
  'Volante',
  'Maestro',
  'Captain',
  'Sweeper',
  'Striker',
  'Fullback',
  'Tactician',
  'Gaffer',
  'Anchor',
  'Dribbler',
  'Enganche',
  'Target',
];

/** "GoldenLibero42" */
export function generateUsername(random: () => number = Math.random): string {
  const pick = <T>(l: readonly T[]) => l[Math.floor(random() * l.length)]!;
  return `${pick(ADJECTIVES)}${pick(NOUNS)}${Math.floor(random() * 90) + 10}`;
}
