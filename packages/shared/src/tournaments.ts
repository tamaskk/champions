import type { LeagueTableLine } from './clubs';
import type { League } from './leagues';

/** Competitions a finished squad can enter. Rules per mode are still to be defined. */
export const TOURNAMENT_MODES = [
  { id: 'random-champions-league', label: 'Random Champions League' },
  { id: 'champions-league', label: 'Champions League' },
  { id: 'random-world-cup', label: 'Random World Cup' },
  { id: 'world-cup', label: 'World Cup' },
  { id: 'random-league', label: 'Random League' },
  { id: 'league', label: 'League' },
  { id: 'match', label: 'Match' },
  { id: 'legends', label: 'Legends' },
  { id: 'h2h', label: 'Head-to-Head' },
  { id: 'challenge', label: 'Challenge' },
] as const;

export type TournamentMode = (typeof TOURNAMENT_MODES)[number]['id'];

/** Last season that is over (a season ends in May/June): in September 2026 that is 2025/26. */
export function lastCompleteSeason(now = new Date()): number {
  return now.getMonth() >= 6 ? now.getFullYear() - 1 : now.getFullYear() - 2;
}

/** First season we have for a league (the Bundesliga started in 1963). */
export const leagueFirstSeason = (league: League) => (league === 'GER' ? 1963 : 1960);

/** One club's line in a final league table. */
export type LeagueTableRow = LeagueTableLine & { clubSlug: string; club: string; elo: number | null };

/** GET /api/table?league=ENG&season=1975, or ?random=1 for a random completed league season. */
export type LeagueTableResponse = { league: League; season: number; rows: LeagueTableRow[] };

/** Your team takes the place of the weakest club: the one that finished last. */
export function weakestClub(rows: readonly LeagueTableRow[]): LeagueTableRow | null {
  return rows.reduce<LeagueTableRow | null>((w, r) => (!w || r.position > w.position ? r : w), null);
}
