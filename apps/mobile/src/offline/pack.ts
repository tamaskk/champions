import type { League, OfflineDraftCell, OfflineLeagueSeasons } from '@champion/shared';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { loadJSON, saveJSON } from '@/game/storage';

/**
 * The offline pack on this device: every club's decade squad (for the draft) and every club
 * season's XI (opponents), downloaded once and read when the server can't be reached. On phones
 * the files live in the app's documents folder; on web (no room in localStorage) the pack only
 * lasts for the session.
 *
 * `offline` is true while the game is running from the pack: results then are local only – not
 * ranked, no coins.
 */

export type PackState = {
  status: 'none' | 'downloading' | 'ready' | 'error';
  /** Files done / files in all, while downloading. */
  done: number;
  total: number;
  version: string | null;
  /** ISO day of the download. */
  downloadedAt: string | null;
  /** The last request for game data was answered from the pack. */
  offline: boolean;
};

type Meta = { version: string; downloadedAt: string };

const memory = new Map<string, unknown>();
const web = Platform.OS === 'web';
const read = <T>(name: string): T | null => (web ? ((memory.get(name) as T | undefined) ?? null) : loadJSON<T>(name));
const write = (name: string, data: unknown) => (web ? void (data === null ? memory.delete(name) : memory.set(name, data)) : saveJSON(name, data));

const meta = read<Meta>('offline-pack');
let state: PackState = {
  status: meta ? 'ready' : 'none',
  done: 0,
  total: 0,
  version: meta?.version ?? null,
  downloadedAt: meta?.downloadedAt ?? null,
  offline: false,
};
const listeners = new Set<() => void>();
export const setPackState = (patch: Partial<PackState>) => {
  if ((Object.keys(patch) as (keyof PackState)[]).every((k) => state[k] === patch[k])) return;
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
export const packState = () => state;

export function usePack(): PackState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export const packReady = () => state.status === 'ready';

const cellFile = (league: League, decade: number) => `offline-draft-${league}-${decade}`;
const seasonsFile = (league: League) => `offline-seasons-${league}`;

// The files are a megabyte or two each: the last few read stay parsed in memory.
const KEEP = 6;
const recent = new Map<string, unknown>();
function cached<T>(name: string): T | null {
  if (recent.has(name)) return recent.get(name) as T;
  const data = read<T>(name);
  if (data) {
    recent.set(name, data);
    if (recent.size > KEEP) recent.delete(recent.keys().next().value!);
  }
  return data;
}

export const packCell = (league: League, decade: number) => (packReady() ? cached<OfflineDraftCell>(cellFile(league, decade)) : null);
export const packSeasons = (league: League) => (packReady() ? cached<OfflineLeagueSeasons>(seasonsFile(league)) : null);

export const storeCell = (cell: OfflineDraftCell) => write(cellFile(cell.league, cell.decade), cell);
export const storeSeasons = (seasons: OfflineLeagueSeasons) => write(seasonsFile(seasons.league), seasons);

export function finishPack(version: string) {
  const downloadedAt = new Date().toISOString().slice(0, 10);
  write('offline-pack', { version, downloadedAt } satisfies Meta);
  recent.clear();
  setPackState({ status: 'ready', version, downloadedAt });
}

export function erasePack(cells: { league: League; decade: number }[], leagues: League[]) {
  for (const c of cells) write(cellFile(c.league, c.decade), null);
  for (const l of leagues) write(seasonsFile(l), null);
  write('offline-pack', null);
  recent.clear();
  setPackState({ status: 'none', version: null, downloadedAt: null, done: 0, total: 0, offline: false });
}
