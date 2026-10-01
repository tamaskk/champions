import {
  sideFromLineup,
  simulateTournament,
  type PlayChoice,
  type PlayRequest,
  type PlayResponse,
  type SaveSquadRequest,
  type SquadResult,
} from '@champion/shared';
import { useSyncExternalStore } from 'react';

import { track } from '@/game/analytics';
import {
  PACK_DATA,
  isUnreachable,
  listSquadRequest,
  playTournament,
  saveSquad,
  secondChanceRequest,
  squadShareUrl,
} from '@/api/client';
import type { DraftPlayer } from '@/mocks/players';
import { packReady, setPackState } from '@/offline/pack';

import { recordProgress, teamName } from './progress';
import { ensureUser } from './user';
import { refreshWallet } from './wallet';

/**
 * The current squad on the server. Tournaments are played by the server (never on the phone for a
 * result that counts): the first time the squad plays, it is saved there "unlisted", the server
 * simulates and stores the result, and the app shows it. "Save to leaderboard" then only puts the
 * squad (with the results the server recorded) onto the public list.
 *
 * Offline (server unreachable, offline pack on the device): match, legend, league and cup are
 * simulated on the phone with the same code and the pack's clubs. Those results are local only:
 * not stored on the server, not ranked, no coins.
 */

export type ResultReport = Omit<SquadResult, 'at'>;

export type OnlineState = {
  /** The leaderboard listing: idle (not listed), saving, saved (listed), error. */
  status: 'idle' | 'saving' | 'saved' | 'error';
  /** The squad's id on the server, once uploaded (listed or not). */
  onlineId?: string;
  results: ResultReport[];
  squad: Omit<SaveSquadRequest, 'userId'> | null;
  /** The last tournament was played on the phone (offline): its result is not ranked. */
  offlineResult: boolean;
};

/** The drafted players themselves (ratings, positions, careers): what an offline simulation needs. */
type LocalSquad = { formation: string; lineup: (DraftPlayer | null)[]; bench: (DraftPlayer | null)[] };
let local: LocalSquad | null = null;

let state: OnlineState = { status: 'idle', results: [], squad: null, offlineResult: false };
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

const sameSquad = (a: OnlineState['squad'], b: OnlineState['squad']) =>
  !!a && !!b && JSON.stringify([a.formation, a.players, a.bench]) === JSON.stringify([b.formation, b.players, b.bench]);

/** The drafted squad (XI, bench, captain). A changed squad is a new one on the server. */
export function setCurrentSquad(squad: Omit<SaveSquadRequest, 'userId'>, players: LocalSquad) {
  local = players;
  if (sameSquad(state.squad, squad)) return;
  set({ status: 'idle', onlineId: undefined, results: [], squad, offlineResult: false });
}

export function clearCurrentSquad() {
  local = null;
  set({ status: 'idle', onlineId: undefined, results: [], squad: null, offlineResult: false });
}

let uploading: Promise<string> | null = null;

/** The squad's id on the server, uploading it (unlisted) the first time it's needed. */
export async function ensureOnlineSquad(): Promise<string> {
  if (state.onlineId) return state.onlineId;
  if (!state.squad) throw new Error('No squad');
  uploading ??= (async () => {
    const user = await ensureUser();
    const { id } = await saveSquad({ ...state.squad!, userId: user.userId, listed: false });
    set({ onlineId: id });
    return id;
  })().finally(() => {
    uploading = null;
  });
  return uploading;
}

/** Plays a tournament on the server with the current squad; the result is already stored there. */
export async function playOnline(choice: PlayChoice): Promise<PlayResponse> {
  try {
    const id = await ensureOnlineSquad();
    const user = await ensureUser();
    const result = await playTournament(id, { ...choice, userId: user.userId, teamName: teamName() } as PlayRequest);
    set({ offlineResult: false });
    setPackState({ offline: false });
    track('tournament_done', { mode: choice.mode });
    return result;
  } catch (error) {
    // Server unreachable: the modes that only need real clubs are played here, from the pack.
    const solo = choice.mode === 'match' || choice.mode === 'legend' || choice.mode === 'league' || choice.mode === 'cup';
    if (!solo || !local || !packReady() || !isUnreachable(error)) throw error;
    const matchPlayer = (p: DraftPlayer | null) => p && { ...p, rating: p.rating ?? null };
    const you = sideFromLineup(teamName(), local.formation, local.lineup.map(matchPlayer), local.bench.map(matchPlayer));
    const result = await simulateTournament(choice, you, PACK_DATA);
    set({ offlineResult: true });
    setPackState({ offline: true });
    track('tournament_done', { mode: choice.mode });
    return result;
  }
}

/** Uses a Second chance for this squad on the server (it takes the item from the wallet). */
export async function secondChanceOnline(): Promise<boolean> {
  try {
    const id = await ensureOnlineSquad();
    const user = await ensureUser();
    const r = await secondChanceRequest(id, user.userId, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    await refreshWallet();
    return r.ok;
  } catch {
    return false;
  }
}

/** Puts the current squad on the leaderboard (uploading it first if it never played). */
export async function saveCurrentSquad(): Promise<void> {
  if (!state.squad || state.status === 'saving' || state.status === 'saved') return;
  set({ status: 'saving' });
  try {
    const user = await ensureUser();
    if (state.onlineId) {
      await listSquadRequest(state.onlineId, user.userId);
    } else {
      const { id } = await saveSquad({ ...state.squad, userId: user.userId, listed: true });
      set({ onlineId: id });
    }
    set({ status: 'saved' });
  } catch {
    set({ status: 'error' });
  }
}

/** A result the server produced for this squad: kept for the share card, counted for progress. */
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
}

/** The current squad's public link (puts it on the leaderboard first if needed). */
export async function currentSquadLink(): Promise<string | null> {
  await saveCurrentSquad();
  return state.onlineId ? squadShareUrl(state.onlineId) : null;
}
