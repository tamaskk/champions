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
  /** Failed logins in a row, and a lock after too many. */
  failedLogins?: number;
  lockedUntil?: Date | null;
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
  side: H2HSide;
  status: "waiting" | "matched" | "expired";
  createdAt: Date;
  match?: H2HMatched;
};

// Reuse one client across hot reloads in dev and across invocations on Vercel.
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

/** The Mongo client, for multi-document transactions (wallet + ledger). */
export async function mongoClient() {
  return (await getDb()).client;
}
