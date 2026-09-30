import "server-only";

import {
  DECADES,
  FORMATIONS,
  LEAGUE_ADJECTIVES,
  PLAYER_ROLES,
  decadeLabel,
  formationLayout,
  formationRoles,
  slugify,
  squadSummary,
  type ChemistryPlayer,
  type League,
  generateUsername,
  type LeaderboardEntry,
  type SaveSquadRequest,
  type SavedPlayer,
  type SquadDetail,
  type UserResponse,
} from "@champion/shared";
import { ObjectId, type WithId } from "mongodb";
import { randomUUID } from "node:crypto";

import { savedSquads, users, type SavedSquadDoc } from "./db";
import { createSession } from "./session";
import { squadInDecade } from "./squad-data";

export class BadRequest extends Error {
  name = "BadRequest";
  status = 400;
}

/** No valid session token. */
export class Unauthorized extends BadRequest {
  status = 401;
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
      await col.insertOne({ ...user, sessionsIssued: true });
      return { userId: user.userId, username: user.username, token: await createSession(user.userId) };
    } catch {
      // Username taken (unique index): try another.
    }
  }
  throw new Error("Could not generate a free username");
}

/** The player behind a userId (400 if unknown). */
export async function userOf(userId: unknown) {
  if (typeof userId !== "string") throw new Unauthorized("Not signed in – please restart the app");
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
    ...(x.captain === true ? { captain: true } : {}),
  };
}

/** A substitute: any role, no spot. */
function cleanBenchPlayer(p: unknown): SavedPlayer {
  const x = (p ?? {}) as Partial<SavedPlayer>;
  return cleanPlayer({ ...x, spot: "SUB", captain: false });
}

const leagueOf = (label: string) =>
  (Object.keys(LEAGUE_ADJECTIVES) as League[]).find((l) => LEAGUE_ADJECTIVES[l] === label || l === label) ?? null;
const decadeOf = (label: string) => DECADES.find((d) => decadeLabel(d) === label || String(d) === label) ?? null;

/**
 * The squad as the server sees it: every player looked up in the club's real squad of that decade
 * (rating, positions and career for chemistry come from the database, never from the client), then
 * overall, rating and chemistry computed with the same function the app uses. A player that can't be
 * found (e.g. a demo player where no squad is imported) counts as unrated and without links.
 */
export async function verifySquad(formation: string, sent: SavedPlayer[], sentBench: SavedPlayer[] = []) {
  const layout = formationLayout(formation);
  const roles = formationRoles(formation);
  sent.forEach((p, i) => {
    if (p.spot !== layout[i]!.code || p.role !== roles[i]) throw new BadRequest(`players[${i}]: spot`);
  });
  if (new Set(sent.map((p) => `${p.name}|${p.club}|${p.decade}`)).size !== sent.length) throw new BadRequest("players: duplicate");
  if (sent.filter((p) => p.captain).length > 1) throw new BadRequest("players: one captain at most");

  const squads = new Map<string, Awaited<ReturnType<typeof squadInDecade>>>();
  type Checked = ChemistryPlayer & { rating: number | null; goals: number | null; appearances: number | null };
  const lookUp = async (p: SavedPlayer): Promise<{ player: Checked; saved: SavedPlayer }> => {
    const league = leagueOf(p.league);
    const decade = decadeOf(p.decade);
    const clubSlug = slugify(p.club);
    let found: Awaited<ReturnType<typeof squadInDecade>>[number] | undefined;
    if (league && decade && clubSlug) {
      const key = `${league}|${decade}|${clubSlug}`;
      if (!squads.has(key)) squads.set(key, await squadInDecade(league, decade, clubSlug));
      const nameSlug = slugify(p.name);
      found = squads.get(key)!.find((q) => q.nameSlug === nameSlug || q.name === p.name);
    }
    const rating = found?.rating ?? null;
    return {
      player: {
        id: found?.nameSlug ?? slugify(p.name),
        name: p.name,
        position: found?.position ?? p.role,
        positions: found?.positions ?? [],
        chemistry: found?.chemistry ?? null,
        rating,
        goals: found?.goals ?? null,
        appearances: found?.appearances ?? null,
        captain: p.captain === true,
      },
      saved: { ...p, rating },
    };
  };
  const lineup: Checked[] = [];
  const players: SavedPlayer[] = [];
  for (const p of sent) {
    const r = await lookUp(p);
    lineup.push(r.player);
    players.push(r.saved);
  }
  const benchLineup: Checked[] = [];
  const bench: SavedPlayer[] = [];
  for (const p of sentBench.slice(0, 5)) {
    const r = await lookUp({ ...p, captain: false });
    benchLineup.push(r.player);
    bench.push({ ...r.saved, spot: "SUB" });
  }
  const summary = squadSummary(formation, lineup);
  return {
    lineup,
    benchLineup,
    bench,
    players,
    overall: Math.round(summary.overall * 100) / 100,
    rating: Math.round(summary.rating * 100) / 100,
    chemistry: summary.chemistry.team,
  };
}

export async function saveSquad(body: SaveSquadRequest | null): Promise<{ id: string }> {
  if (!body) throw new BadRequest("JSON body expected");
  const user = await userOf(body.userId);
  if (!(FORMATIONS as readonly string[]).includes(body.formation)) throw new BadRequest("formation");
  if (!Array.isArray(body.players) || body.players.length !== 11) throw new BadRequest("players: 11 expected");
  // Overall, rating and chemistry are recomputed here from the database – the client's numbers are ignored.
  const bench = Array.isArray(body.bench) ? body.bench.slice(0, 5).map(cleanBenchPlayer) : [];
  const squad = await verifySquad(body.formation, body.players.map(cleanPlayer), bench);
  const doc: SavedSquadDoc = {
    userId: user.userId,
    username: user.username,
    formation: body.formation,
    overall: squad.overall,
    rating: squad.rating,
    chemistry: squad.chemistry,
    players: squad.players,
    bench: squad.bench,
    listed: body.listed !== false,
    plays: 0,
    extraPlays: 0,
    results: [],
    createdAt: new Date(),
  };
  const { insertedId } = await (await savedSquads()).insertOne(doc);
  return { id: insertedId.toHexString() };
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
  // Squads saved only to play (not put on the leaderboard by their owner) stay hidden.
  const listed = { listed: { $ne: false } };
  const filter = period === "week" ? { ...listed, createdAt: { $gte: new Date(Date.now() - 7 * 86_400_000) } } : listed;
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
