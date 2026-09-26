import { dailyChecks, type DailyChallenge, type DailyOutcome } from './daily';

/**
 * Mini-leagues: private groups of friends, joined with an invite code. Every member's official
 * Daily Challenge score counts; the table is the week's total (Monday–Sunday, UTC days – the
 * same days the Daily changes on).
 */

export const MINI_LEAGUE = {
  maxMembers: 50,
  /** Leagues one player can be in. */
  maxPerUser: 10,
  nameMax: 30,
  codeLength: 6,
  /** Invite code letters: no 0/O, 1/I/L. */
  codeAlphabet: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
};

/**
 * Score of one Daily: 100 when every target is met, plus overall and chemistry (0–100 each), so
 * a squad that misses a target still scores for how close it got. 0–300.
 */
export const DAILY_SCORE = { success: 100 };

export function dailyScore(ch: DailyChallenge, o: DailyOutcome): { score: number; success: boolean } {
  const success = dailyChecks(ch, o).every((c) => c.ok);
  const score = (success ? DAILY_SCORE.success : 0) + Math.round(o.overall) + Math.round(o.chemistry);
  return { score, success };
}

/** The seven UTC days (YYYY-MM-DD) of the Monday–Sunday week that contains `date`. */
export function weekDates(date: string): string[] {
  const d = new Date(`${date}T00:00:00Z`);
  const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 86_400_000).toISOString().slice(0, 10));
}

export function normalizeLeagueCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** POST /api/daily/score – your official result of a day's challenge (practice tries are not sent). */
export type DailyScoreRequest = {
  userId: string;
  date: string;
  challengeId: string;
  outcome: DailyOutcome;
};
export type DailyScoreResponse = {
  score: number;
  success: boolean;
  /** false: a score for that day was already in (the first one counts). */
  counted: boolean;
  /** Mini-leagues the score counts in. */
  leagues: number;
};

export type MiniLeagueSummary = {
  id: string;
  name: string;
  code: string;
  members: number;
  owner: boolean;
  /** Your place and points this week. */
  rank: number;
  points: number;
};
/** POST /api/leagues {userId} */
export type MiniLeaguesResponse = { leagues: MiniLeagueSummary[] };

export type MiniLeagueStanding = {
  username: string;
  you: boolean;
  /** The week's total. */
  points: number;
  /** Dailies played this week. */
  played: number;
  /** Score per day of the week (null = not played), Monday first. */
  days: (number | null)[];
  /** Targets met per day (null = not played). */
  success: (boolean | null)[];
};

/** POST /api/leagues/detail {userId, id, week?} */
export type MiniLeagueDetail = {
  id: string;
  name: string;
  code: string;
  owner: boolean;
  members: number;
  /** The week shown (Monday first) and today (UTC). */
  dates: string[];
  today: string;
  standings: MiniLeagueStanding[];
};
