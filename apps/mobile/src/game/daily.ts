import { useSyncExternalStore } from 'react';

import { recordProgress } from './progress';
import { claim } from './wallet';
import { loadJSON, saveJSON } from './storage';

/**
 * Daily challenge attempts on this device: one a day. The attempt starts with the draft (leaving
 * it still uses the day up); the result and the emoji share text are kept.
 */

export type DailyAttempt = { title: string; done: boolean; success: boolean; share: string };
type Attempts = Record<string, DailyAttempt>;

let attempts: Attempts = loadJSON<Attempts>('daily') ?? {};
const listeners = new Set<() => void>();
const set = (next: Attempts) => {
  attempts = next;
  saveJSON('daily', attempts);
  listeners.forEach((l) => l());
};

export function useDailyAttempts(): Attempts {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => attempts,
  );
}

export function startDailyAttempt(date: string, title: string) {
  if (attempts[date]) return;
  set({ ...attempts, [date]: { title, done: false, success: false, share: '' } });
}

export function finishDailyAttempt(date: string, success: boolean, share: string) {
  if (attempts[date]?.done) return;
  set({ ...attempts, [date]: { title: attempts[date]?.title ?? '', done: true, success, share } });
  recordProgress({ kind: 'daily', won: success, streak: success ? dailyStreak(date) : 0 });
  if (success) void claim('daily-challenge', date, 'Daily Challenge won');
}

/** Days in a row with a completed (won) challenge, up to today. */
export function dailyStreak(today: string, all: Attempts = attempts): number {
  let n = 0;
  for (let d = new Date(`${today}T00:00:00Z`); ; d = new Date(d.getTime() - 86_400_000)) {
    const key = d.toISOString().slice(0, 10);
    if (all[key]?.success) n++;
    else if (key !== today) break;
    else if (all[key]?.done) break;
  }
  return n;
}
