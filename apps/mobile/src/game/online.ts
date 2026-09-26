import type { SaveSquadRequest, SquadResult } from '@champion/shared';
import { useSyncExternalStore } from 'react';

import { postSquadResult, saveSquad, squadShareUrl } from '@/api/client';

import { recordProgress } from './progress';
import { ensureUser } from './user';

/**
 * The current squad on the online leaderboard: save it under your username, and attach what it
 * achieved once its tournament is played (before or after saving).
 */

export type ResultReport = Omit<SquadResult, 'at'>;

export type OnlineState = {
  status: 'idle' | 'saving' | 'saved' | 'error';
  onlineId?: string;
  results: ResultReport[];
  squad: Omit<SaveSquadRequest, 'userId'> | null;
};

let state: OnlineState = { status: 'idle', results: [], squad: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<OnlineState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export function useOnline(): OnlineState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/** A completed draft: can now be saved. */
export function setCurrentSquad(squad: Omit<SaveSquadRequest, 'userId'>) {
  set({ status: 'idle', onlineId: undefined, results: [], squad });
}

export function clearCurrentSquad() {
  set({ status: 'idle', onlineId: undefined, results: [], squad: null });
}

/** Saves the current squad (with its results so far). */
export async function saveCurrentSquad(): Promise<void> {
  if (!state.squad || state.status === 'saving' || state.status === 'saved') return;
  set({ status: 'saving' });
  try {
    const user = await ensureUser();
    const { id } = await saveSquad({ ...state.squad, userId: user.userId });
    for (const r of state.results) await postSquadResult(id, user.userId, r).catch(() => undefined);
    set({ status: 'saved', onlineId: id });
  } catch {
    set({ status: 'error' });
  }
}

/** The squad's tournament result; sent to the leaderboard at once if the squad is saved. */
export function reportResult(r: ResultReport) {
  set({ results: [...state.results, r] });
  // Progress: league seasons are counted by recordSeason (they need W-D-L), dailies by the daily store.
  if (r.mode === 'match' && (r.outcome === 'win' || r.outcome === 'draw' || r.outcome === 'loss')) {
    recordProgress({ kind: 'match', outcome: r.outcome });
  } else if (r.mode === 'cup' && r.outcome !== 'win' && r.outcome !== 'draw' && r.outcome !== 'loss') {
    recordProgress({ kind: 'cup', outcome: r.outcome });
  } else if (r.mode === 'legend') {
    recordProgress({ kind: 'legend', won: r.outcome === 'win' });
  }
  if (state.status === 'saved' && state.onlineId) {
    ensureUser()
      .then((u) => postSquadResult(state.onlineId!, u.userId, r))
      .catch(() => undefined);
  }
}

/** The current squad's public link (saves it on the leaderboard first if needed). */
export async function currentSquadLink(): Promise<string | null> {
  await saveCurrentSquad();
  return state.onlineId ? squadShareUrl(state.onlineId) : null;
}
