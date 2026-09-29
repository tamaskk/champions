/**
 * Coin economy (see monetization.md). Coins live on the server only: the device asks for a claim
 * ("I won today's daily"), the server decides the amount from these tables, enforces the caps and
 * records every movement in a ledger with an idempotency key, so a claim can never pay twice.
 *
 * Pure data and helpers, shared by the app (to show what a claim is worth) and the server (to
 * decide it). Nothing here grants a player, a rating or a match advantage (see store.ts).
 */

import type { DailyTier } from './daily';

// ---------------------------------------------------------------------------------------------
// Faucets: where coins come from

/** Daily login, a 7-day cycle; missing a day starts it again. */
export const LOGIN_CYCLE = [10, 15, 20, 25, 30, 40, 100] as const;

export const DAILY_CHALLENGE_COINS: Record<DailyTier, number> = { SILVER: 30, GOLD: 50, LEGEND: 100 };

/** First win against a legend; the Immortals (tier 3) pay more. */
export const LEGEND_COINS = { normal: 50, immortal: 150 } as const;

export const H2H_WIN_COINS = 20;
export const H2H_WINS_PER_DAY = 10;

export const levelUpCoins = (level: number) => 50 * level;

/** Every 5th level also gives an exclusive cosmetic (earned only, never sold). */
export const LEVEL_MILESTONES: Record<number, string> = {
  5: 'frame-bronze',
  10: 'kit-emerald',
  15: 'crest-trophy',
  20: 'frame-silver',
  25: 'kit-obsidian',
  30: 'crest-comet',
  35: 'frame-platinum',
  40: 'kit-royal',
  45: 'crest-medal',
  50: 'frame-champion',
};
/** Milestone cosmetics up to (and including) `level`. */
export const milestonesUpTo = (level: number) =>
  Object.entries(LEVEL_MILESTONES)
    .filter(([l]) => Number(l) <= level)
    .map(([, id]) => id);

/** Coins per achievement id; anything not listed pays DEFAULT_ACHIEVEMENT_COINS. */
export const ACHIEVEMENT_COINS: Record<string, number> = {
  'first-draft': 25,
  'first-win': 25,
  perfect: 500,
  unbeaten: 300,
  title: 150,
  cup: 200,
  'chemistry-100': 250,
  'legends-5': 300,
  'beat-milan-88': 150,
  'daily-7': 200,
  'overall-90': 150,
};
export const DEFAULT_ACHIEVEMENT_COINS = 50;

export const AD_COINS = 20;
export const ADS_PER_DAY = 5;
export const SHARE_COINS = 15;
export const INVITE_COINS = 300;
/** Invite codes can only be redeemed by players this new (days since the account was created). */
export const INVITE_MAX_ACCOUNT_AGE_DAYS = 7;

/** Spinvincible Club subscribers collect this once a day (with a daily-practice try). */
export const CLUB_DAILY_COINS = 50;
/** Members' exclusive share-card frame. */
export const CLUB_FRAME = 'frame-club';

/** What a device may claim. The server decides the amount; `key` makes each claim unique. */
export type ClaimSource =
  | 'daily-login'
  | 'daily-challenge'
  | 'legend'
  | 'h2h-win'
  | 'level-up'
  | 'achievement'
  | 'rewarded-ad'
  | 'share'
  | 'club-daily'
  | 'season-pass'
  | 'h2h-rank';

export type ClaimRequest = { userId: string; source: ClaimSource; key: string };

/** Head-to-head ranks by (server-checked) wins this calendar month; they reset every month. */
export const H2H_RANKS = [
  { id: 'bronze', name: 'Bronze', wins: 0 },
  { id: 'silver', name: 'Silver', wins: 5 },
  { id: 'gold', name: 'Gold', wins: 15 },
  { id: 'legend', name: 'Legend', wins: 30 },
] as const;
export type H2HRank = (typeof H2H_RANKS)[number];

/** Reaching a rank pays once per month. */
export const H2H_RANK_REWARDS: Record<string, { coins: number; cosmetic?: string }> = {
  silver: { coins: 100 },
  gold: { coins: 250 },
  legend: { coins: 500, cosmetic: 'frame-legend' },
};

export const h2hRankOf = (wins: number): H2HRank =>
  [...H2H_RANKS].reverse().find((r) => wins >= r.wins) ?? H2H_RANKS[0];

// ---------------------------------------------------------------------------------------------
// XP multipliers (on the device: XP is progress, not money)

/** The first won match of the day (UTC) earns double XP. */
export const FIRST_WIN_XP_MULTIPLIER = 2;

/** Daily Challenge streak: 3+ days ×1.2, 7+ days ×1.5 on daily XP. */
export function streakMultiplier(streak: number): number {
  if (streak >= 7) return 1.5;
  if (streak >= 3) return 1.2;
  return 1;
}

/** Free re-spins per squad draft in the casual game; more cost a bought re-spin (store). */
export const FREE_RESPINS_PER_DRAFT = 3;

/** Levels cap here; a prestige starts again from level 1 and keeps an exclusive frame. */
export const MAX_LEVEL = 50;

// ---------------------------------------------------------------------------------------------
// Season Pass: a calendar month; season XP resets, lifetime XP (level) stays.

export const PASS_TIERS = 30;
export const PASS_XP_PER_TIER = 1000;

/** "2026-09" */
export const seasonOf = (date = new Date()) => date.toISOString().slice(0, 7);

export type PassReward = { coins: number; cosmetic?: string };

/** Free track: a little every 5 tiers. Premium: coins every tier + cosmetics at 10/20/30. */
export function passReward(tier: number, track: 'free' | 'premium'): PassReward | null {
  if (tier < 1 || tier > PASS_TIERS) return null;
  if (track === 'free') return tier % 5 === 0 ? { coins: 40 } : null;
  const cosmetic = tier === 10 ? 'frame-season' : tier === 20 ? 'kit-season' : tier === 30 ? 'crest-season' : undefined;
  return { coins: tier % 5 === 0 ? 60 : 25, ...(cosmetic ? { cosmetic } : {}) };
}

/** Premium track in total (the pass "pays back" about this much). */
export const PASS_PREMIUM_TOTAL = Array.from({ length: PASS_TIERS }, (_, i) => passReward(i + 1, 'premium')!.coins).reduce(
  (a, b) => a + b,
  0,
);

// ---------------------------------------------------------------------------------------------
// Real-money products (RevenueCat product ids). Prices come from the store's price tiers.

export const STARTER_PACK = { id: 'starter-pack', coins: 500, eur: 1.99, cosmetic: 'frame-starter' } as const;
export const SEASON_PASS_PRODUCT = { id: 'season-pass', eur: 4.99 } as const;
export const CLUB_SUBSCRIPTION = { id: 'champion-club', eurPerMonth: 2.99 } as const;

// ---------------------------------------------------------------------------------------------
// API shapes

export type WalletResponse = {
  username: string;
  balance: number;
  /** Cosmetics owned (store item ids, plus earned ones like 'frame-starter'). */
  owned: string[];
  /** Convenience items bought and not used yet: item id → count. */
  consumables: Record<string, number>;
  login: { streakDay: number; claimedToday: boolean; nextCoins: number };
  adsToday: number;
  sharedToday: boolean;
  inviteCode: string;
  invited: boolean;
  entitlements: { seasonPass: string | null; clubUntil: string | null; starterPack: boolean };
  /** Season Pass tiers already collected this season, per track. */
  passClaimed: { free: number[]; premium: number[] };
  season: string;
  /** Head-to-head wins this month and the rank they give. */
  h2h: { wins: number; rank: string };
  /** Days since the account was created (the starter pack is offered in the first few). */
  accountAgeDays: number;
};

/** The starter pack is advertised on Home during an account's first days. */
export const STARTER_OFFER_DAYS = 3;

export type ClaimResponse = { granted: number; balance: number; reason?: string };

export type SpendResponse = { ok: boolean; balance: number; reason?: string };
