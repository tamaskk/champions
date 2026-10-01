import {
  LEAGUES,
  OFFLINE_CELLS,
  type OfflineDraftCell,
  type OfflineLeagueSeasons,
  type OfflineManifest,
} from '@champion/shared';

import { apiBaseUrl } from '@/api/client';

import { erasePack, finishPack, packState, setPackState, storeCell, storeSeasons } from './pack';

/** Files fetched at a time. */
const PARALLEL = 3;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBaseUrl()}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/** Downloads the whole pack (about 40 files); the old one keeps working until the new one is complete. */
export async function downloadPack(): Promise<boolean> {
  if (packState().status === 'downloading') return false;
  const before = packState().status;
  try {
    const manifest = await get<OfflineManifest>('/api/offline/manifest');
    const jobs: (() => Promise<void>)[] = [
      ...manifest.cells.map((c) => async () => storeCell(await get<OfflineDraftCell>(`/api/offline/draft?league=${c.league}&decade=${c.decade}`))),
      ...manifest.leagues.map((l) => async () => storeSeasons(await get<OfflineLeagueSeasons>(`/api/offline/seasons?league=${l}`))),
    ];
    setPackState({ status: 'downloading', done: 0, total: jobs.length });
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < jobs.length) {
        await jobs[next++]!();
        setPackState({ done: ++done });
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    finishPack(manifest.version);
    return true;
  } catch {
    // Every file on the device is complete (old or new), so a pack that was ready stays usable.
    setPackState({ status: before === 'ready' ? 'ready' : 'error' });
    return false;
  }
}

export function deletePack() {
  erasePack(OFFLINE_CELLS, [...LEAGUES]);
}

/** Whether the server has a newer pack than the one on the device (null: can't tell, offline). */
export async function packUpdateAvailable(): Promise<boolean | null> {
  try {
    const manifest = await get<OfflineManifest>('/api/offline/manifest');
    return manifest.version !== packState().version;
  } catch {
    return null;
  }
}
