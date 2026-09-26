import { LEAGUE_NAMES, seasonLabel, type League, type SeasonResult, type SquadInsight } from '@champion/shared';
import { useSyncExternalStore } from 'react';

import { recordSeason } from './session';
import { loadJSON, saveJSON } from './storage';

/**
 * A league season played matchday by matchday. The whole season is simulated when it starts (so
 * leaving and coming back can't change a result); the player then reveals it one matchday at a
 * time – watching his own match live, fast or as a result – or jumps to the end. Saved on the
 * device after every step, so the season can be continued at any time, even after a restart.
 */

export const YOUR_ID = '__you__';

export type LeagueSeasonSave = {
  v: 1;
  league: League;
  season: number;
  /** Hall of Fame squad, for the season record at the end. */
  squadId: number | null;
  teamName: string;
  formation: string;
  overall: number;
  chemistry: number;
  /** The real club your XI replaced. */
  replaced: string;
  /** Every club with its average XI rating (yours included, as YOUR_ID). */
  teams: { id: string; name: string; rating: number | null }[];
  /** The simulated season; your fixtures carry the whole match (`detail`). */
  result: SeasonResult;
  rounds: number;
  /** Your lines against the league's average (the "why" under the final result). */
  insight?: SquadInsight;
  /** Substitutes on your bench. */
  bench?: number;
  /** Matchdays shown so far (0 = none, `rounds` = season over). */
  revealed: number;
  /** The season record (XP, achievements, Hall of Fame) has been written. */
  recorded: boolean;
  startedAt: string;
};

const FILE = 'league-season';

let current: LeagueSeasonSave | null = (() => {
  const saved = loadJSON<LeagueSeasonSave>(FILE);
  return saved?.v === 1 ? saved : null;
})();
const listeners = new Set<() => void>();
const set = (next: LeagueSeasonSave | null) => {
  current = next;
  saveJSON(FILE, next);
  listeners.forEach((l) => l());
};

export function useLeagueSeason(): LeagueSeasonSave | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

export const leagueSeasonTitle = (s: Pick<LeagueSeasonSave, 'league' | 'season'>) =>
  `${LEAGUE_NAMES[s.league].split(' / ')[0]} ${seasonLabel(s.season)}`;

/** A new season (replaces an unfinished one). */
export function startLeagueSeason(save: Omit<LeagueSeasonSave, 'v' | 'revealed' | 'recorded' | 'startedAt'>) {
  set({ ...save, v: 1, revealed: 0, recorded: false, startedAt: new Date().toISOString() });
}

/** Shows matchdays up to `round` (never goes back). The last one writes the season record. */
export function revealLeagueRound(round: number) {
  if (!current || round <= current.revealed) return;
  const next = { ...current, revealed: Math.min(round, current.rounds) };
  if (next.revealed === next.rounds && !next.recorded) {
    const row = next.result.table.find((r) => r.id === YOUR_ID);
    if (row && next.squadId !== null) {
      recordSeason(next.squadId, {
        league: next.league,
        label: `${LEAGUE_NAMES[next.league].split(' / ')[0]} '${seasonLabel(next.season).slice(2)}`,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        points: row.points,
        position: row.position,
      });
    }
    next.recorded = true;
  }
  set(next);
}

/** Done with the season (after its result has been seen). */
export function clearLeagueSeason() {
  set(null);
}
