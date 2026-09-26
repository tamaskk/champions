import { useSyncExternalStore } from 'react';

import { recordProgress } from './progress';
import { claim } from './wallet';
import { loadJSON, saveJSON } from './storage';

/** Your legends collection: every legendary team you have beaten (kept on the device). */

export type Trophy = { date: string; score: string; formation: string };
type Collection = Record<string, Trophy>;

let beaten: Collection = loadJSON<Collection>('legends') ?? {};
const listeners = new Set<() => void>();

export function useLegendCollection(): Collection {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => beaten,
  );
}

/** A legend beaten: collected (the first win is kept). */
export function collectLegend(id: string, trophy: Trophy) {
  if (beaten[id]) return;
  beaten = { ...beaten, [id]: trophy };
  saveJSON('legends', beaten);
  listeners.forEach((l) => l());
  recordProgress({ kind: 'legend-beaten', legendId: id });
  void claim('legend', id, 'Legend collected');
}
