import type { ClubSeason, SquadPlayer } from "@champion/shared";
import { MongoClient, type Db } from "mongodb";

import { requireEnv } from "./env";

// Mirrors apps/web/src/server/db.ts: same collection names, same unique keys.
export type ClubSeasonDoc = ClubSeason & {
  createdAt: Date;
  updatedAt: Date;
  /** Set by tm:squads after a club season's Transfermarkt squad was fully written. */
  tmSquadImportedAt?: Date;
  /** Importer version that wrote it (see IMPORT_VERSION in commands/tm-squads.ts). */
  tmSquadImportVersion?: number;
};
export type SquadPlayerDoc = SquadPlayer & { createdAt: Date; updatedAt: Date; fetchedAt?: Date };

let client: MongoClient | null = null;

export async function connectDb(): Promise<Db> {
  client ??= await new MongoClient(requireEnv("MONGODB_URI")).connect();
  const db = client.db(process.env.MONGODB_DB || "champion");
  await db
    .collection<SquadPlayerDoc>("squadPlayers")
    .createIndexes([
      { key: { league: 1, season: 1, clubSlug: 1, nameSlug: 1 }, unique: true },
      { key: { tmPlayerId: 1 } },
    ]);
  return db;
}

export async function closeDb() {
  await client?.close();
  client = null;
}

export const clubSeasonsOf = (db: Db) => db.collection<ClubSeasonDoc>("clubSeasons");
export const squadPlayersOf = (db: Db) => db.collection<SquadPlayerDoc>("squadPlayers");
