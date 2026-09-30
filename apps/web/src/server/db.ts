import "server-only";

import type {
  ClubSeason,
  DailyChallenge,
  H2HMatched,
  H2HSide,
  SaveSquadRequest,
  SquadPlayer,
  SquadResult,
} from "@champion/shared";
import { MongoClient, type Collection, type Db } from "mongodb";

export class DbNotConfiguredError extends Error {
  constructor() {
    super("MONGODB_URI is not set. Add it to apps/web/.env.local.");
  }
}

export type ClubSeasonDoc = ClubSeason & { createdAt: Date; updatedAt: Date };

export type SquadPlayerDoc = SquadPlayer & { createdAt: Date; updatedAt: Date };

export type ImportLogDoc = {
  createdAt: Date;
  fileName: string | null;
  rows: number;
  inserted: number;
  existing: number;
  leagues: string[];
  seasonFrom: number;
  seasonTo: number;
};

/** A player of the app: secret id (kept on the device) and a public generated username. */
export type UserDoc = {
  userId: string;
  username: string;
  createdAt: Date;
  /** Registered accounts only (guests have none of these). */
  email?: string;
  name?: string;
  /** "scrypt$<salt hex>$<hash hex>" – never the password itself. */
  passwordHash?: string;
  registeredAt?: Date;
  /** Hash of the account's backup (recovery) code; restoring with it signs a device in. */
  recoveryHash?: string | null;
  /** A session was issued for this account (after that, the userId alone no longer signs in). */
  sessionsIssued?: boolean;
  /** Failed logins in a row, and a lock after too many. */
  failedLogins?: number;
  lockedUntil?: Date | null;
  /** Password reset: hash of the emailed 6-digit code, when it expires, wrong tries, when it was sent. */
  resetCodeHash?: string | null;
  resetExpires?: Date | null;
  resetAttempts?: number;
  resetSentAt?: Date | null;
};

/** Coins and what they bought. Balance only changes together with a ledger entry (transaction). */
export type WalletDoc = {
  userId: string;
  balance: number;
  owned: string[];
  consumables: Record<string, number>;
  login: { lastDate: string | null; streakDay: number };
  inviteCode: string;
  invitedBy: string | null;
  entitlements: { seasonPass: string | null; clubUntil: Date | null; starterPack: boolean };
  passClaimed: { season: string; free: number[]; premium: number[] };
  createdAt: Date;
  updatedAt: Date;
};

/** Every coin movement: + earned/bought, − spent. `key` makes each one happen at most once. */
export type LedgerDoc = {
  userId: string;
  key: string;
  source: string;
  amount: number;
  balanceAfter: number;
  meta?: Record<string, unknown>;
  createdAt: Date;
};

/** A squad saved on the leaderboard. */
export type SavedSquadDoc = Omit<SaveSquadRequest, "userId"> & {
  userId: string;
  username: string;
  results: SquadResult[];
  createdAt: Date;
  /** Tournaments played on the server, and extra ones allowed by Second chances (1 + extra in all). */
  plays?: number;
  extraPlays?: number;
};

/** A daily challenge scheduled for a date (admin, JSON import or Claude). */
export type DailyChallengeDoc = DailyChallenge & {
  date: string;
  createdAt: Date;
  source: "admin" | "import" | "claude";
};

/** Head-to-head queue ticket; once matched it holds this player's view of the match. */
export type H2HTicketDoc = {
  userId: string;
  /** The saved squad playing (its result is stored there). */
  squadId?: string;
  side: H2HSide;
  status: "waiting" | "matched" | "expired";
  createdAt: Date;
  match?: H2HMatched;
};

// Reuse one client across hot reloads in dev and across invocations on Vercel.
/** One rate-limit counter: requests of a key (route + IP or user) in one time window. */
export type RateLimitDoc = { _id: string; count: number; expiresAt: Date };

/** A signed-in device: the hash of its bearer token (the token itself never touches the database). */
export type SessionDoc = {
  tokenHash: string;
  userId: string;
  createdAt: Date;
  lastUsedAt: Date;
};

/** A player's official Daily Challenge result (one per day; the first one counts). */
export type DailyScoreDoc = {
  userId: string;
  date: string;
  challengeId: string;
  score: number;
  success: boolean;
  overall: number;
  chemistry: number;
  createdAt: Date;
  /** The day's legend match (played on the server), shown again if the result is asked for twice. */
  played?: import("@champion/shared").PlayedMatch | null;
  checks?: { label: string; ok: boolean }[];
};

/** A private mini-league of friends (joined with its invite code). */
export type MiniLeagueDoc = {
  name: string;
  code: string;
  ownerId: string;
  /** userIds, in joining order. */
  members: string[];
  createdAt: Date;
};

/** Someone waiting for the app launch (landing page sign-up). */
export type WaitlistDoc = {
  email: string;
  createdAt: Date;
  /** Where the sign-up came from (hero / bottom form). */
  source: string;
  locale: string | null;
};

/** One anonymous analytics event from the app (see @champion/shared analytics). */
export type EventDoc = {
  install: string;
  event: string;
  props: Record<string, string>;
  /** When it happened on the device (clamped to the receive time). */
  at: Date;
  /** UTC day of `at`, "2026-09-30". */
  day: string;
  receivedAt: Date;
};

/** A JavaScript error reported by the app. */
export type CrashDoc = {
  install: string;
  message: string;
  stack: string | null;
  where: string | null;
  fatal: boolean;
  platform: string | null;
  version: string | null;
  createdAt: Date;
};

const globalForMongo = globalThis as unknown as { mongo?: Promise<Db> };

async function connect(uri: string): Promise<Db> {
  const client = await new MongoClient(uri).connect();
  const db = client.db(process.env.MONGODB_DB || "champion");
  await db
    .collection<ClubSeasonDoc>("clubSeasons")
    .createIndexes([{ key: { league: 1, season: 1, clubSlug: 1 }, unique: true }, { key: { decade: 1, league: 1 } }]);
  await db.collection<SquadPlayerDoc>("squadPlayers").createIndexes([
    { key: { league: 1, season: 1, clubSlug: 1, nameSlug: 1 }, unique: true },
    // Chemistry: a player's whole career across clubs.
    { key: { tmPlayerId: 1 } },
  ]);
  await db.collection<UserDoc>("users").createIndexes([
    { key: { userId: 1 }, unique: true },
    { key: { username: 1 }, unique: true },
    // One account per email (guests have no email, so the index skips them).
    { key: { email: 1 }, unique: true, partialFilterExpression: { email: { $type: "string" } } },
  ]);
  await db.collection<SavedSquadDoc>("savedSquads").createIndexes([{ key: { overall: -1 } }, { key: { userId: 1 } }]);
  await db.collection<H2HTicketDoc>("h2hTickets").createIndexes([{ key: { status: 1, createdAt: 1 } }]);
  await db.collection<DailyChallengeDoc>("dailyChallenges").createIndexes([{ key: { date: 1 }, unique: true }]);
  await db.collection<WalletDoc>("wallets").createIndexes([
    { key: { userId: 1 }, unique: true },
    { key: { inviteCode: 1 }, unique: true },
  ]);
  await db.collection<LedgerDoc>("coinLedger").createIndexes([
    { key: { userId: 1, key: 1 }, unique: true },
    { key: { userId: 1, source: 1, createdAt: -1 } },
  ]);
  // Counters delete themselves once their window is over.
  await db.collection<RateLimitDoc>("rateLimits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection<SessionDoc>("sessions").createIndexes([
    { key: { tokenHash: 1 }, unique: true },
    { key: { userId: 1 } },
  ]);
  await db.collection<UserDoc>("users").createIndex({ recoveryHash: 1 }, { partialFilterExpression: { recoveryHash: { $type: "string" } } });
  await db.collection<WaitlistDoc>("waitlist").createIndexes([{ key: { email: 1 }, unique: true }, { key: { createdAt: -1 } }]);
  await db.collection<DailyScoreDoc>("dailyScores").createIndexes([
    { key: { userId: 1, date: 1 }, unique: true },
    { key: { date: 1 } },
  ]);
  await db
    .collection<MiniLeagueDoc>("miniLeagues")
    .createIndexes([{ key: { code: 1 }, unique: true }, { key: { members: 1 } }]);
  // Analytics and crash reports expire after ANALYTICS_LIMITS.keepDays (180).
  await db.collection<EventDoc>("events").createIndexes([
    { key: { receivedAt: 1 }, expireAfterSeconds: 180 * 86400 },
    { key: { day: 1, event: 1 } },
  ]);
  await db.collection<CrashDoc>("crashes").createIndexes([
    { key: { createdAt: 1 }, expireAfterSeconds: 180 * 86400 },
    { key: { message: 1 } },
  ]);
  return db;
}

export function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return Promise.reject(new DbNotConfiguredError());
  globalForMongo.mongo ??= connect(uri).catch((error) => {
    globalForMongo.mongo = undefined; // retry on the next request
    throw error;
  });
  return globalForMongo.mongo;
}

export async function clubSeasons(): Promise<Collection<ClubSeasonDoc>> {
  return (await getDb()).collection<ClubSeasonDoc>("clubSeasons");
}

export async function squadPlayers(): Promise<Collection<SquadPlayerDoc>> {
  return (await getDb()).collection<SquadPlayerDoc>("squadPlayers");
}

export async function importLogs(): Promise<Collection<ImportLogDoc>> {
  return (await getDb()).collection<ImportLogDoc>("imports");
}

export async function users(): Promise<Collection<UserDoc>> {
  return (await getDb()).collection<UserDoc>("users");
}

export async function savedSquads(): Promise<Collection<SavedSquadDoc>> {
  return (await getDb()).collection<SavedSquadDoc>("savedSquads");
}

export async function dailyChallenges(): Promise<Collection<DailyChallengeDoc>> {
  return (await getDb()).collection<DailyChallengeDoc>("dailyChallenges");
}

export async function h2hTickets(): Promise<Collection<H2HTicketDoc>> {
  return (await getDb()).collection<H2HTicketDoc>("h2hTickets");
}

export async function wallets(): Promise<Collection<WalletDoc>> {
  return (await getDb()).collection<WalletDoc>("wallets");
}

export async function coinLedger(): Promise<Collection<LedgerDoc>> {
  return (await getDb()).collection<LedgerDoc>("coinLedger");
}

export async function rateLimits(): Promise<Collection<RateLimitDoc>> {
  return (await getDb()).collection<RateLimitDoc>("rateLimits");
}

export async function sessions(): Promise<Collection<SessionDoc>> {
  return (await getDb()).collection<SessionDoc>("sessions");
}

export async function waitlist(): Promise<Collection<WaitlistDoc>> {
  return (await getDb()).collection<WaitlistDoc>("waitlist");
}

export async function dailyScores(): Promise<Collection<DailyScoreDoc>> {
  return (await getDb()).collection<DailyScoreDoc>("dailyScores");
}

export async function miniLeagues(): Promise<Collection<MiniLeagueDoc>> {
  return (await getDb()).collection<MiniLeagueDoc>("miniLeagues");
}

/** The Mongo client, for multi-document transactions (wallet + ledger). */
export async function events(): Promise<Collection<EventDoc>> {
  return (await getDb()).collection<EventDoc>("events");
}

export async function crashes(): Promise<Collection<CrashDoc>> {
  return (await getDb()).collection<CrashDoc>("crashes");
}

export async function mongoClient() {
  return (await getDb()).client;
}
