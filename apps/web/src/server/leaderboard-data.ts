import "server-only";

import {
  FORMATIONS,
  PLAYER_ROLES,
  generateUsername,
  type LeaderboardEntry,
  type SaveSquadRequest,
  type SavedPlayer,
  type SquadDetail,
  type SquadResult,
  type UserResponse,
} from "@champion/shared";
import { ObjectId, type WithId } from "mongodb";
import { randomUUID } from "node:crypto";

import { savedSquads, users, type SavedSquadDoc } from "./db";

export class BadRequest extends Error {
  name = "BadRequest";
}

const num = (x: unknown, lo: number, hi: number) =>
  typeof x === "number" && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null;
const str = (x: unknown, max = 60) => (typeof x === "string" ? x.slice(0, max) : "");
const oid = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

/** A new player with a free generated username. */
export async function createUser(): Promise<UserResponse> {
  const col = await users();
  for (let tries = 0; tries < 8; tries++) {
    const user = { userId: randomUUID(), username: generateUsername(), createdAt: new Date() };
    try {
      await col.insertOne(user);
      return { userId: user.userId, username: user.username };
    } catch {
      // Username taken (unique index): try another.
    }
  }
  throw new Error("Could not generate a free username");
}

/** The player behind a userId (400 if unknown). */
export async function userOf(userId: unknown) {
  if (typeof userId !== "string") throw new BadRequest("userId missing");
  const user = await (await users()).findOne({ userId });
  if (!user) throw new BadRequest("Unknown user");
  return user;
}

function cleanPlayer(p: unknown): SavedPlayer {
  const x = (p ?? {}) as Partial<SavedPlayer>;
  if (!PLAYER_ROLES.includes(x.role as never)) throw new BadRequest("player.role");
  return {
    spot: str(x.spot, 4),
    role: x.role!,
    name: str(x.name, 80),
    rating: num(x.rating, 0, 100),
    club: str(x.club, 80),
    decade: str(x.decade, 6),
    league: str(x.league, 20),
  };
}

export async function saveSquad(body: SaveSquadRequest | null): Promise<{ id: string }> {
  if (!body) throw new BadRequest("JSON body expected");
  const user = await userOf(body.userId);
  if (!(FORMATIONS as readonly string[]).includes(body.formation)) throw new BadRequest("formation");
  if (!Array.isArray(body.players) || body.players.length !== 11) throw new BadRequest("players: 11 expected");
  const doc: SavedSquadDoc = {
    userId: user.userId,
    username: user.username,
    formation: body.formation,
    overall: num(body.overall, 0, 100) ?? 0,
    rating: num(body.rating, 0, 100) ?? 0,
    chemistry: Math.round(num(body.chemistry, 0, 100) ?? 0),
    players: body.players.map(cleanPlayer),
    results: [],
    createdAt: new Date(),
  };
  const { insertedId } = await (await savedSquads()).insertOne(doc);
  return { id: insertedId.toHexString() };
}

const MODES = ["match", "league", "cup", "legend", "daily", "h2h"] as const;
const OUTCOMES = ["win", "draw", "loss", "champion", "top", "mid", "out"] as const;

/** A tournament result of a saved squad (only its owner can add one). */
export async function addSquadResult(id: string, body: { userId?: string; result?: SquadResult } | null) {
  const _id = oid(id);
  if (!_id || !body?.result) throw new BadRequest("id / result");
  const r = body.result;
  if (!MODES.includes(r.mode) || !OUTCOMES.includes(r.outcome)) throw new BadRequest("result");
  const result: SquadResult = {
    mode: r.mode,
    outcome: r.outcome,
    title: str(r.title, 80),
    detail: str(r.detail, 80),
    at: new Date().toISOString(),
  };
  const { matchedCount } = await (
    await savedSquads()
  ).updateOne({ _id, userId: str(body.userId, 64) }, { $push: { results: { $each: [result], $slice: -20 } } });
  if (!matchedCount) throw new BadRequest("Not your squad");
}

const entryOf = (d: WithId<SavedSquadDoc>): LeaderboardEntry => ({
  id: d._id.toHexString(),
  username: d.username,
  formation: d.formation,
  overall: d.overall,
  chemistry: d.chemistry,
  result: d.results.at(-1) ?? null,
  createdAt: d.createdAt.toISOString(),
});

/** Highest overall first; `period` = all time or the last 7 days. */
export async function leaderboard(limit = 50, period: "all" | "week" = "all"): Promise<LeaderboardEntry[]> {
  const filter = period === "week" ? { createdAt: { $gte: new Date(Date.now() - 7 * 86_400_000) } } : {};
  const docs = await (
    await savedSquads()
  )
    .find(filter, { projection: { players: 0 } })
    .sort({ overall: -1, createdAt: 1 })
    .limit(Math.min(100, Math.max(1, limit)))
    .toArray();
  return docs.map((d) => entryOf(d as WithId<SavedSquadDoc>));
}

export async function squadDetail(id: string): Promise<SquadDetail | null> {
  const _id = oid(id);
  if (!_id) return null;
  const d = await (await savedSquads()).findOne({ _id });
  if (!d) return null;
  return { ...entryOf(d), rating: d.rating, players: d.players, results: d.results };
}
