import { useSyncExternalStore } from 'react';

import { recordProgress } from './progress';
import { loadJSON, saveJSON } from './storage';

/**
 * The player's records (Home "Your records", Explore "Hall of Fame"), saved on the device so they
 * survive an app restart.
 */

export type SavedSquad = {
  id: number;
  formation: string;
  overall: number;
  chemistry: number;
  /** Best simulated league season with this XI, if any. */
  season?: {
    league: string;
    label: string;
    won: number;
    drawn: number;
    lost: number;
    points: number;
    position: number;
  };
  /** A few names, for the card subtitle. */
  names: string[];
};

export type Records = {
  draftsPlayed: number;
  peakOverall: number | null;
  maxChemistry: number | null;
  bestRun: { won: number; drawn: number; lost: number } | null;
  squads: SavedSquad[];
};

// Hall of Fame keeps the most recent squads only, so the saved file stays small.
const MAX_SQUADS = 100;

let records: Records = loadJSON<Records>('records') ?? {
  draftsPlayed: 0,
  peakOverall: null,
  maxChemistry: null,
  bestRun: null,
  squads: [],
};
const listeners = new Set<() => void>();
const set = (next: Records) => {
  records = { ...next, squads: next.squads.slice(0, MAX_SQUADS) };
  saveJSON('records', records);
  listeners.forEach((l) => l());
};

export function useRecords(): Records {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => records,
  );
}

let nextId = Math.max(0, ...records.squads.map((s) => s.id)) + 1;

/** A finished draft (called when the summary opens). Returns the squad id for later results. */
export function recordDraft(squad: Omit<SavedSquad, 'id'>): number {
  const id = nextId++;
  set({
    ...records,
    draftsPlayed: records.draftsPlayed + 1,
    peakOverall: Math.max(records.peakOverall ?? 0, squad.overall),
    maxChemistry: Math.max(records.maxChemistry ?? 0, squad.chemistry),
    squads: [{ ...squad, id }, ...records.squads],
  });
  return id;
}

/** A simulated league season of squad `id`. Keeps each squad's best season and the overall best run. */
export function recordSeason(id: number, season: NonNullable<SavedSquad['season']>) {
  recordProgress({
    kind: 'season',
    won: season.won,
    drawn: season.drawn,
    lost: season.lost,
    points: season.points,
    position: season.position,
  });
  const better = (a: { won: number; drawn: number }, b?: { won: number; drawn: number } | null) =>
    !b || a.won * 3 + a.drawn > b.won * 3 + b.drawn;
  set({
    ...records,
    bestRun: better(season, records.bestRun)
      ? { won: season.won, drawn: season.drawn, lost: season.lost }
      : records.bestRun,
    squads: records.squads.map((s) => (s.id === id && better(season, s.season) ? { ...s, season } : s)),
  });
}
