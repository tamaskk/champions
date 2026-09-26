import type { SquadDetail } from '@champion/shared';
import { useSyncExternalStore } from 'react';

/**
 * A saved squad someone shared ("Challenge this XI"): kept until your next drafted XI plays it
 * from the tournament picker.
 */

let pending: SquadDetail | null = null;
const listeners = new Set<() => void>();

export function setPendingChallenge(squad: SquadDetail | null) {
  pending = squad;
  listeners.forEach((l) => l());
}

export const getPendingChallenge = () => pending;

export function usePendingChallenge(): SquadDetail | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pending,
  );
}
