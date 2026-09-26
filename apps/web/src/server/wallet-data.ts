import "server-only";

import {
  ACHIEVEMENT_COINS,
  ADS_PER_DAY,
  AD_COINS,
  CLUB_DAILY_COINS,
  DAILY_CHALLENGE_COINS,
  DEFAULT_ACHIEVEMENT_COINS,
  EARNED_COSMETICS,
  H2H_WINS_PER_DAY,
  H2H_WIN_COINS,
  INVITE_COINS,
  INVITE_MAX_ACCOUNT_AGE_DAYS,
  LEGENDS,
  LEGEND_COINS,
  LOGIN_CYCLE,
  MAX_LEVEL,
  PASS_TIERS,
  SHARE_COINS,
  STORE_ITEMS,
  isConsumable,
  CLUB_FRAME,
  H2H_RANKS,
  H2H_RANK_REWARDS,
  h2hRankOf,
  milestonesUpTo,
  levelUpCoins,
  passReward,
  seasonOf,
  validateStoreItem,
  type ClaimResponse,
  type ClaimSource,
  type SpendResponse,
  type WalletResponse,
} from "@champion/shared";
import { randomInt } from "node:crypto";
import { ObjectId, type ClientSession } from "mongodb";

import { dailyChallenge } from "./daily-data";
import { coinLedger, h2hTickets, mongoClient, users, wallets, type WalletDoc } from "./db";
import { BadRequest, userOf } from "./leaderboard-data";

/**
 * Server-side wallet. Coins only move here, always as (wallet update + ledger entry) in one
 * transaction; the ledger's unique (userId, key) makes every claim, purchase and spend
 * idempotent. The device never names an amount: it says what happened, this file decides.
 *
 * Trust: daily login, the daily challenge tier, h2h wins and purchases are checked on the
 * server. Level-ups, achievements, legends, shares and pass tiers are reported by the device
 * (its progress lives there), so they are capped per day and paid once per key.
 */

const today = () => new Date().toISOString().slice(0, 10);
const dayStart = () => new Date(`${today()}T00:00:00.000Z`);
const yesterday = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newInviteCode = () => Array.from({ length: 6 }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]).join("");

/** Device-reported claims per UTC day (the rest are one per key or checked on the server). */
const DAILY_CAPS: Partial<Record<ClaimSource, number>> = {
  "level-up": 3,
  achievement: 5,
  legend: 5,
  "rewarded-ad": ADS_PER_DAY,
  "h2h-win": H2H_WINS_PER_DAY,
  "season-pass": 6,
};

// ---------------------------------------------------------------------------------------------

/** The user's wallet, created on first use. */
async function walletOf(userId: string, session?: ClientSession): Promise<WalletDoc> {
  const col = await wallets();
  const found = await col.findOne({ userId }, { session });
  if (found) return found;
  for (let tries = 0; tries < 5; tries++) {
    const now = new Date();
    const doc: WalletDoc = {
      userId,
      balance: 0,
      owned: [],
      consumables: {},
      login: { lastDate: null, streakDay: 0 },
      inviteCode: newInviteCode(),
      invitedBy: null,
      entitlements: { seasonPass: null, clubUntil: null, starterPack: false },
      passClaimed: { season: seasonOf(), free: [], premium: [] },
      createdAt: now,
      updatedAt: now,
    };
    try {
      await col.insertOne(doc, { session });
      return doc;
    } catch {
      const again = await col.findOne({ userId }, { session });
      if (again) return again; // created meanwhile
      // invite code taken: try another
    }
  }
  throw new Error("Could not create a wallet");
}

async function inTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = (await mongoClient()).startSession();
  try {
    let out: T;
    await session.withTransaction(async () => {
      out = await work(session);
    });
    return out!;
  } finally {
    await session.endSession();
  }
}

class AlreadyDone extends Error {}

/**
 * Moves coins: `amount` > 0 credits, < 0 debits (fails if the balance is too low). `update` adds
 * other changes to the wallet in the same transaction. A repeated `key` changes nothing.
 */
async function move(
  userId: string,
  key: string,
  source: string,
  amount: number,
  update: Record<string, unknown> = {},
  meta?: Record<string, unknown>,
): Promise<{ ok: boolean; balance: number; duplicate?: boolean }> {
  await walletOf(userId);
  try {
    return await inTransaction(async (session) => {
      const ledger = await coinLedger();
      if (await ledger.findOne({ userId, key }, { session })) throw new AlreadyDone();
      const col = await wallets();
      const filter = amount < 0 ? { userId, balance: { $gte: -amount } } : { userId };
      const set = { ...(update.$set as object), updatedAt: new Date() };
      const wallet = await col.findOneAndUpdate(
        filter,
        { ...update, $inc: { ...(update.$inc as object), balance: amount }, $set: set },
        { session, returnDocument: "after" },
      );
      if (!wallet) return { ok: false, balance: (await walletOf(userId, session)).balance };
      await ledger.insertOne(
        { userId, key, source, amount, balanceAfter: wallet.balance, meta, createdAt: new Date() },
        { session },
      );
      return { ok: true, balance: wallet.balance };
    });
  } catch (error) {
    if (error instanceof AlreadyDone || (error as { code?: number }).code === 11000) {
      return { ok: false, balance: (await walletOf(userId)).balance, duplicate: true };
    }
    throw error;
  }
}

async function claimsToday(userId: string, source: string) {
  return (await coinLedger()).countDocuments({ userId, source, createdAt: { $gte: dayStart() } });
}

// ---------------------------------------------------------------------------------------------
// Read

export async function getWallet(userIdRaw: unknown): Promise<WalletResponse> {
  const user = await userOf(userIdRaw);
  const w = await walletOf(user.userId);
  const claimedToday = w.login.lastDate === today();
  // Today's reward if not collected yet, else tomorrow's (if the streak goes on).
  const nextDay = claimedToday
    ? (w.login.streakDay % 7) + 1
    : w.login.lastDate === yesterday()
      ? (w.login.streakDay % 7) + 1
      : 1;
  const season = seasonOf();
  const h2hWins = await h2hWinsThisMonth(user.userId);
  return {
    username: user.username,
    balance: w.balance,
    owned: w.owned,
    consumables: w.consumables,
    login: { streakDay: w.login.streakDay, claimedToday, nextCoins: LOGIN_CYCLE[nextDay - 1] },
    adsToday: await claimsToday(user.userId, "rewarded-ad"),
    sharedToday: (await claimsToday(user.userId, "share")) > 0,
    inviteCode: w.inviteCode,
    invited: !!w.invitedBy,
    entitlements: {
      seasonPass: w.entitlements.seasonPass,
      clubUntil: w.entitlements.clubUntil ? w.entitlements.clubUntil.toISOString() : null,
      starterPack: w.entitlements.starterPack,
    },
    passClaimed: w.passClaimed.season === season ? { free: w.passClaimed.free, premium: w.passClaimed.premium } : { free: [], premium: [] },
    season,
    h2h: { wins: h2hWins, rank: h2hRankOf(h2hWins).name },
    accountAgeDays: Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000),
  };
}

/** Server-checked head-to-head wins this calendar month (paid h2h-win claims). */
async function h2hWinsThisMonth(userId: string) {
  return (await coinLedger()).countDocuments({
    userId,
    source: "h2h-win",
    createdAt: { $gte: new Date(`${seasonOf()}-01T00:00:00.000Z`) },
  });
}

// ---------------------------------------------------------------------------------------------
// Claims (faucets)

const reject = (reason: string, balance: number): ClaimResponse => ({ granted: 0, balance, reason });

export async function claim(body: { userId?: unknown; source?: unknown; key?: unknown } | null): Promise<ClaimResponse> {
  const user = await userOf(body?.userId);
  const userId = user.userId;
  const source = body?.source as ClaimSource;
  const key = typeof body?.key === "string" ? body.key.slice(0, 64) : "";
  const w = await walletOf(userId);

  const cap = DAILY_CAPS[source];
  if (cap !== undefined && (await claimsToday(userId, source)) >= cap) return reject("Daily limit reached", w.balance);

  let amount = 0;
  let ledgerKey = "";
  let update: Record<string, unknown> = {};

  switch (source) {
    case "daily-login": {
      const day = today();
      if (w.login.lastDate === day) return reject("Already collected today", w.balance);
      const streakDay = w.login.lastDate === yesterday() ? (w.login.streakDay % 7) + 1 : 1;
      amount = LOGIN_CYCLE[streakDay - 1];
      ledgerKey = `daily-login:${day}`;
      update = { $set: { login: { lastDate: day, streakDay } } };
      break;
    }
    case "daily-challenge": {
      // The device won today's (or, across time zones, yesterday's) challenge; the tier is ours.
      if (key !== today() && key !== yesterday()) return reject("Only today's challenge", w.balance);
      const daily = await dailyChallenge(key);
      amount = DAILY_CHALLENGE_COINS[daily.challenge.tier];
      ledgerKey = `daily-challenge:${key}`;
      break;
    }
    case "legend": {
      const legend = LEGENDS.find((l) => l.id === key);
      if (!legend) return reject("Unknown legend", w.balance);
      amount = legend.tier === 3 ? LEGEND_COINS.immortal : LEGEND_COINS.normal;
      ledgerKey = `legend:${key}`;
      break;
    }
    case "h2h-win": {
      // Checked on the server: the ticket is yours and you won that match.
      const ticket = ObjectId.isValid(key) ? await (await h2hTickets()).findOne({ _id: new ObjectId(key), userId }) : null;
      const m = ticket?.match;
      if (!m) return reject("Unknown match", w.balance);
      const [ours, theirs] = m.youAtHome ? [m.result.homeGoals, m.result.awayGoals] : [m.result.awayGoals, m.result.homeGoals];
      if (ours <= theirs) return reject("Not a win", w.balance);
      amount = H2H_WIN_COINS;
      ledgerKey = `h2h-win:${key}`;
      break;
    }
    case "level-up": {
      const level = Number(key);
      if (!Number.isInteger(level) || level < 2 || level > MAX_LEVEL) return reject("Invalid level", w.balance);
      amount = levelUpCoins(level);
      ledgerKey = `level-up:${level}`;
      // Every 5th level's cosmetic, including missed earlier ones.
      update = { $addToSet: { owned: { $each: milestonesUpTo(level) } } };
      break;
    }
    case "achievement": {
      if (!/^[a-z0-9-]{2,40}$/.test(key)) return reject("Invalid achievement", w.balance);
      amount = ACHIEVEMENT_COINS[key] ?? DEFAULT_ACHIEVEMENT_COINS;
      ledgerKey = `achievement:${key}`;
      break;
    }
    case "rewarded-ad": {
      // A real ad network confirms views server-to-server (SSV); until one is configured, only
      // simulated ads in development pay out.
      if (!adsEnabled()) return reject("Rewarded ads are not configured", w.balance);
      if (!/^[A-Za-z0-9-]{8,64}$/.test(key)) return reject("Invalid ad id", w.balance);
      amount = AD_COINS;
      ledgerKey = `rewarded-ad:${key}`;
      break;
    }
    case "share": {
      amount = SHARE_COINS;
      ledgerKey = `share:${today()}`;
      break;
    }
    case "club-daily": {
      if (!w.entitlements.clubUntil || w.entitlements.clubUntil < new Date()) return reject("Champion Club only", w.balance);
      amount = CLUB_DAILY_COINS;
      ledgerKey = `club-daily:${today()}`;
      // Members also get a daily practice try and the Club frame.
      update = { $inc: { "consumables.daily-practice": 1 }, $addToSet: { owned: CLUB_FRAME } };
      break;
    }
    case "season-pass": {
      // key "12:premium": tier and track; tiers are collected in order, premium needs the pass.
      const [tierRaw, track] = key.split(":");
      const tier = Number(tierRaw);
      const season = seasonOf();
      if (track !== "free" && track !== "premium") return reject("Invalid track", w.balance);
      if (!Number.isInteger(tier) || tier < 1 || tier > PASS_TIERS) return reject("Invalid tier", w.balance);
      if (track === "premium" && w.entitlements.seasonPass !== season) return reject("Season Pass needed", w.balance);
      const reward = passReward(tier, track);
      if (!reward) return reject("No reward on this tier", w.balance);
      const claimed = w.passClaimed.season === season ? w.passClaimed : { season, free: [], premium: [] };
      amount = reward.coins;
      ledgerKey = `season-pass:${season}:${tier}:${track}`;
      update = {
        $set: { passClaimed: { ...claimed, [track]: [...claimed[track], tier] } },
        ...(reward.cosmetic ? { $addToSet: { owned: reward.cosmetic } } : {}),
      };
      break;
    }
    case "h2h-rank": {
      // Checked on the server: enough head-to-head wins this month for that rank.
      const rank = H2H_RANKS.find((x) => x.id === key);
      const reward = rank && H2H_RANK_REWARDS[rank.id];
      if (!rank || !reward) return reject("No reward for this rank", w.balance);
      if ((await h2hWinsThisMonth(userId)) < rank.wins) return reject(`${rank.name} needs ${rank.wins} wins this month`, w.balance);
      amount = reward.coins;
      ledgerKey = `h2h-rank:${seasonOf()}:${rank.id}`;
      if (reward.cosmetic) update = { $addToSet: { owned: reward.cosmetic } };
      break;
    }
    default:
      return reject("Unknown source", w.balance);
  }

  const r = await move(userId, ledgerKey, source, amount, update, { key });
  return r.ok ? { granted: amount, balance: r.balance } : reject(r.duplicate ? "Already collected" : "Not possible", r.balance);
}

export const adsEnabled = () => process.env.NODE_ENV !== "production" || process.env.ADS_SIMULATED === "1";

// ---------------------------------------------------------------------------------------------
// Invites

export async function redeemInvite(body: { userId?: unknown; code?: unknown } | null): Promise<ClaimResponse> {
  const user = await userOf(body?.userId);
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const w = await walletOf(user.userId);
  if (w.invitedBy) return reject("You already used an invite", w.balance);
  if (Date.now() - user.createdAt.getTime() > INVITE_MAX_ACCOUNT_AGE_DAYS * 86_400_000) {
    return reject(`Invites are for players in their first ${INVITE_MAX_ACCOUNT_AGE_DAYS} days`, w.balance);
  }
  const inviter = await (await wallets()).findOne({ inviteCode: code });
  if (!inviter) return reject("Unknown invite code", w.balance);
  if (inviter.userId === user.userId) return reject("That's your own code", w.balance);

  const mine = await move(user.userId, "invite:redeemed", "invite", INVITE_COINS, { $set: { invitedBy: inviter.userId } }, { code });
  if (!mine.ok) return reject("You already used an invite", mine.balance);
  await move(inviter.userId, `invite:friend:${user.userId}`, "invite", INVITE_COINS, {}, { friend: user.username });
  return { granted: INVITE_COINS, balance: mine.balance };
}

// ---------------------------------------------------------------------------------------------
// Spending

/** Buys a store item. Cosmetics are owned once; convenience items stack as consumables. */
export async function buyItem(body: { userId?: unknown; itemId?: unknown; requestId?: unknown } | null): Promise<SpendResponse> {
  const user = await userOf(body?.userId);
  const item = STORE_ITEMS.find((i) => i.id === body?.itemId);
  const requestId = typeof body?.requestId === "string" ? body.requestId.slice(0, 64) : "";
  const w = await walletOf(user.userId);
  if (!item || validateStoreItem(item).length) return { ok: false, balance: w.balance, reason: "Unknown item" };
  if (item.available === false) return { ok: false, balance: w.balance, reason: "Coming soon" };
  if (item.effect.kind === "rename") return { ok: false, balance: w.balance, reason: "Use rename" };
  if (!requestId) throw new BadRequest("requestId missing");
  const consumable = isConsumable(item);
  if (!consumable && w.owned.includes(item.id)) return { ok: false, balance: w.balance, reason: "Already owned" };

  const update = consumable ? { $inc: { [`consumables.${item.id}`]: 1 } } : { $addToSet: { owned: item.id } };
  const r = await move(user.userId, `buy:${requestId}`, "buy", -item.price, update, { itemId: item.id });
  return r.ok ? { ok: true, balance: r.balance } : { ok: false, balance: r.balance, reason: r.duplicate ? "Already done" : "Not enough coins" };
}

/** Uses one convenience item (e.g. an extra re-spin). Never in competitive modes (store.ts). */
export async function consumeItem(body: { userId?: unknown; itemId?: unknown; requestId?: unknown } | null): Promise<SpendResponse> {
  const user = await userOf(body?.userId);
  const itemId = typeof body?.itemId === "string" ? body.itemId : "";
  const requestId = typeof body?.requestId === "string" ? body.requestId.slice(0, 64) : "";
  if (!requestId) throw new BadRequest("requestId missing");
  const col = await wallets();
  // Idempotent via the ledger (0-coin entry records the use).
  const r = await inTransaction(async (session) => {
    const ledger = await coinLedger();
    if (await ledger.findOne({ userId: user.userId, key: `use:${requestId}` }, { session })) return "done" as const;
    const w = await col.findOneAndUpdate(
      { userId: user.userId, [`consumables.${itemId}`]: { $gte: 1 } },
      { $inc: { [`consumables.${itemId}`]: -1 }, $set: { updatedAt: new Date() } },
      { session, returnDocument: "after" },
    );
    if (!w) return "none" as const;
    await ledger.insertOne(
      { userId: user.userId, key: `use:${requestId}`, source: "use", amount: 0, balanceAfter: w.balance, meta: { itemId }, createdAt: new Date() },
      { session },
    );
    return "ok" as const;
  });
  const w = await walletOf(user.userId);
  return r === "none" ? { ok: false, balance: w.balance, reason: "None left" } : { ok: true, balance: w.balance };
}

/** Changes the username (a cosmetic store item, 200 coins). */
export async function rename(body: { userId?: unknown; username?: unknown; requestId?: unknown } | null): Promise<SpendResponse> {
  const user = await userOf(body?.userId);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const requestId = typeof body?.requestId === "string" ? body.requestId.slice(0, 64) : "";
  const price = STORE_ITEMS.find((i) => i.id === "rename")!.price;
  const w = await walletOf(user.userId);
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return { ok: false, balance: w.balance, reason: "3–20 letters, digits or _" };
  if (!requestId) throw new BadRequest("requestId missing");
  if (await (await users()).findOne({ username })) return { ok: false, balance: w.balance, reason: "Name taken" };
  const r = await move(user.userId, `rename:${requestId}`, "buy", -price, {}, { username });
  if (!r.ok) return { ok: false, balance: r.balance, reason: r.duplicate ? "Already done" : "Not enough coins" };
  await (await users()).updateOne({ userId: user.userId }, { $set: { username } });
  return { ok: true, balance: r.balance };
}

// ---------------------------------------------------------------------------------------------
// Real-money purchases (RevenueCat webhook, or simulated in development)

export type Purchase =
  | { kind: "coins"; productId: string; coins: number }
  | { kind: "starter" }
  | { kind: "season-pass" }
  | { kind: "club"; until: Date };

/** Credits a store purchase once (`eventId` = the store transaction / webhook event id). */
export async function applyPurchase(userId: string, eventId: string, p: Purchase) {
  switch (p.kind) {
    case "coins":
      return move(userId, `iap:${eventId}`, "purchase", p.coins, {}, { productId: p.productId });
    case "starter":
      return move(
        userId,
        `iap:${eventId}`,
        "purchase",
        500,
        { $set: { "entitlements.starterPack": true }, $addToSet: { owned: EARNED_COSMETICS[0] } },
        { productId: "starter-pack" },
      );
    case "season-pass":
      return move(userId, `iap:${eventId}`, "purchase", 0, { $set: { "entitlements.seasonPass": seasonOf() } }, { productId: "season-pass" });
    case "club":
      return move(userId, `iap:${eventId}`, "purchase", 0, { $set: { "entitlements.clubUntil": p.until } }, { productId: "champion-club" });
  }
}

export const purchasesSimulated = () => process.env.NODE_ENV !== "production" || process.env.PURCHASES_SIMULATED === "1";
