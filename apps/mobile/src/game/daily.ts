import { seededRandom, weekDates } from '@champion/shared';
import { useSyncExternalStore } from 'react';

import type { DraftPick } from '@/components/draft-spin';
import type { Played } from '@/components/match-play';

import { recordProgress } from './progress';
import { claim } from './wallet';
import { loadJSON, saveJSON } from './storage';

/**
 * Daily challenge attempts on this device: one a day. The attempt starts with the draft; leaving it
 * (a call, another app) keeps the draft, which continues exactly where it was (see DailyDraft).
 * The result and the emoji share text are kept.
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
  saveJSON(DRAFT_FILE, null);
  saveJSON(MATCH_FILE, null);
  recordProgress({ kind: 'daily', won: success, streak: dailyStreak(date) });
  if (success) void claim('daily-challenge', date, 'Daily Challenge won');
}

export type StreakInfo = {
  /** Days in a row you played the Daily (won or not), today included once finished. */
  days: number;
  /** Missed days covered by a streak freeze. */
  frozen: string[];
  /** This week's free freeze is still unused. */
  freezeLeft: boolean;
};

const DAY_MS = 86_400_000;
const previousDay = (key: string) => new Date(new Date(`${key}T00:00:00Z`).getTime() - DAY_MS).toISOString().slice(0, 10);

/**
 * The Daily streak counts taking part, not winning: a failed challenge keeps it going. One missed
 * day per calendar week (Monday–Sunday) is covered by a free, automatic streak freeze – nothing to
 * buy, nothing to claim. Today only counts once it is finished, and not playing yet today never
 * breaks the streak.
 */
export function dailyStreakInfo(today: string, all: Attempts = attempts): StreakInfo {
  const played = (key: string) => (key === today ? !!all[key]?.done : !!all[key]);
  const usedWeeks = new Set<string>();
  let days = 0;
  let frozen: string[] = [];
  let oldestPlayed: string | null = null;
  // At most one freeze per week, so the walk ends within about a week of the last day played.
  for (let key = today, guard = 0; guard < 4000; key = previousDay(key), guard++) {
    if (played(key)) {
      days++;
      oldestPlayed = key;
      continue;
    }
    if (key === today) continue;
    const week = weekDates(key)[0]!;
    if (usedWeeks.has(week)) break;
    usedWeeks.add(week);
    frozen.push(key);
  }
  // Freezes only bridge gaps inside the streak, not the days before it started.
  frozen = oldestPlayed ? frozen.filter((k) => k > oldestPlayed!) : [];
  const thisWeek = weekDates(today)[0]!;
  return { days, frozen, freezeLeft: !frozen.some((k) => k >= thisWeek) };
}

/** Days in a row you played the Daily (see dailyStreakInfo). */
export function dailyStreak(today: string, all: Attempts = attempts): number {
  return dailyStreakInfo(today, all).days;
}

// ---- The Daily draft in progress, saved so leaving never costs the day's attempt.

const DRAFT_FILE = 'daily-draft';
const MATCH_FILE = 'daily-match';

/**
 * Saved between draws only (never mid-spin), with the number of seeded reel draws used so far:
 * continuing rewinds the reels to exactly that point, so an interrupted draw replays identically –
 * leaving can't be used as a free re-spin.
 */
export type DailyDraft = {
  date: string;
  challengeId: string;
  formation: string;
  lineup: (DraftPick | null)[];
  pending: DraftPick | null;
  captainId: string | null;
  respinsUsed: number;
  randomCalls: number;
};

export function saveDailyDraft(draft: DailyDraft) {
  saveJSON(DRAFT_FILE, draft);
}

/** The saved draft of that day's challenge, if any (and the day isn't finished). */
export function loadDailyDraft(date: string, challengeId: string): DailyDraft | null {
  if (attempts[date]?.done) return null;
  const d = loadJSON<DailyDraft>(DRAFT_FILE);
  return d && d.date === date && d.challengeId === challengeId ? d : null;
}

/** The day's seeded reels, counting every draw (`calls`); `skip` draws are used up already. */
export function dailyReels(seed: string, skip = 0): { random: () => number; calls: () => number } {
  const next = seededRandom(seed);
  let calls = 0;
  for (; calls < skip; calls++) next();
  return {
    random: () => {
      calls++;
      return next();
    },
    calls: () => calls,
  };
}

/**
 * The legend match of the day, stored at kick-off: leaving during the match and coming back shows
 * the same match again instead of a new one.
 */
export function dailyMatch(date: string): Played | null {
  const m = loadJSON<{ date: string; played: Played }>(MATCH_FILE);
  return m?.date === date ? m.played : null;
}

export function saveDailyMatch(date: string, played: Played) {
  saveJSON(MATCH_FILE, { date, played });
}
