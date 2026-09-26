import "server-only";

import {
  FORMATIONS,
  H2H_WAIT_SECONDS,
  PLAYER_ROLES,
  matchEvents,
  simulateMatch,
  type H2HMatched,
  type H2HQueueRequest,
  type H2HSide,
  type H2HTicket,
  type MatchPlayer,
  type MatchSide,
} from "@champion/shared";
import { ObjectId, type WithId } from "mongodb";

import { h2hTickets, savedSquads, type H2HTicketDoc, type SavedSquadDoc } from "./db";
import { BadRequest, userOf } from "./leaderboard-data";

const num = (x: unknown, lo: number, hi: number) =>
  typeof x === "number" && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null;
const oid = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);
const waitLimit = () => new Date(Date.now() - H2H_WAIT_SECONDS * 1000);

function cleanSide(side: unknown, username: string): H2HSide {
  const s = (side ?? {}) as Partial<H2HSide>;
  if (!Array.isArray(s.xi) || s.xi.length < 7 || s.xi.length > 11) throw new BadRequest("side.xi");
  if (!(FORMATIONS as readonly string[]).includes(s.formation ?? "")) throw new BadRequest("side.formation");
  const xi: MatchPlayer[] = s.xi.map((p) => {
    if (!PLAYER_ROLES.includes(p?.position)) throw new BadRequest("side.xi.position");
    return {
      name: String(p.name ?? "").slice(0, 80),
      position: p.position,
      rating: num(p.rating, 0, 100),
      goals: num(p.goals, 0, 2000),
      appearances: num(p.appearances, 0, 2000),
    };
  });
  return {
    username,
    overall: num(s.overall, 0, 100) ?? 0,
    chemistry: Math.round(num(s.chemistry, 0, 100) ?? 0),
    formation: s.formation!,
    xi,
    // Chemistry factor range is 0.92–1.08.
    factor: num(s.factor, 0.9, 1.1) ?? 1,
  };
}

const matchSide = (s: H2HSide): MatchSide => ({ name: `@${s.username}`, xi: s.xi, factor: s.factor });

/** Plays the match (random venue) and returns each player's view of it. */
function play(a: H2HSide, b: H2HSide, ids: [string, string], ghost = false): { a: H2HMatched; b: H2HMatched } {
  const aHome = Math.random() < 0.5;
  const [home, away] = aHome ? [a, b] : [b, a];
  const result = simulateMatch(matchSide(home), matchSide(away));
  const events = matchEvents(matchSide(home), matchSide(away), result);
  const view = (them: H2HSide, youAtHome: boolean, ticketId: string, isGhost: boolean): H2HMatched => ({
    status: "matched",
    ticketId,
    opponent: {
      username: them.username,
      overall: them.overall,
      chemistry: them.chemistry,
      formation: them.formation,
      xi: them.xi,
      ghost: isGhost,
    },
    youAtHome,
    result,
    events,
  });
  return { a: view(b, aHome, ids[0], ghost), b: view(a, !aHome, ids[1], false) };
}

function ticketView(t: WithId<H2HTicketDoc>): H2HTicket {
  const ticketId = t._id.toHexString();
  if (t.status === "matched" && t.match) return t.match;
  if (t.status === "expired" || t.createdAt < waitLimit()) return { status: "expired", ticketId };
  return { status: "waiting", ticketId, since: t.createdAt.toISOString() };
}

/** Joins the queue: matched at once with the longest-waiting other player, or waits. */
export async function h2hQueue(body: H2HQueueRequest | null): Promise<H2HTicket> {
  if (!body) throw new BadRequest("JSON body expected");
  const user = await userOf(body.userId);
  const side = cleanSide(body.side, user.username);
  const col = await h2hTickets();
  await col.updateMany({ status: "waiting", createdAt: { $lt: waitLimit() } }, { $set: { status: "expired" } });
  // One open ticket per player.
  await col.updateMany({ userId: user.userId, status: "waiting" }, { $set: { status: "expired" } });

  // Claim the longest-waiting opponent atomically (two players can't take the same one).
  const opponent = await col.findOneAndUpdate(
    { status: "waiting", userId: { $ne: user.userId }, createdAt: { $gte: waitLimit() } },
    { $set: { status: "matched" } },
    { sort: { createdAt: 1 }, returnDocument: "after" },
  );
  const _id = new ObjectId();
  if (!opponent) {
    const createdAt = new Date();
    await col.insertOne({ _id, userId: user.userId, side, status: "waiting", createdAt });
    return { status: "waiting", ticketId: _id.toHexString(), since: createdAt.toISOString() };
  }
  const views = play(side, opponent.side, [_id.toHexString(), opponent._id.toHexString()]);
  await col.insertOne({ _id, userId: user.userId, side, status: "matched", createdAt: new Date(), match: views.a });
  await col.updateOne({ _id: opponent._id }, { $set: { match: views.b } });
  return views.a;
}

/** Polling: still waiting, expired, or the match once someone came. */
export async function h2hTicket(id: string, userId: string | null): Promise<H2HTicket | null> {
  const _id = oid(id);
  if (!_id || !userId) return null;
  const t = await (await h2hTickets()).findOne({ _id, userId });
  return t ? ticketView(t) : null;
}

/** Nobody came: a random squad another player saved on the leaderboard stands in. */
export async function h2hGhost(id: string, userId: string | null): Promise<H2HTicket | null> {
  const _id = oid(id);
  if (!_id || !userId) return null;
  const col = await h2hTickets();
  const ticket = await col.findOneAndUpdate(
    { _id, userId, status: { $in: ["waiting", "expired"] } },
    { $set: { status: "matched" } },
    { returnDocument: "after" },
  );
  if (!ticket) {
    const t = await col.findOne({ _id, userId });
    return t ? ticketView(t) : null;
  }
  const [squad] = await (
    await savedSquads()
  )
    .aggregate<WithId<SavedSquadDoc>>([{ $match: { userId: { $ne: userId } } }, { $sample: { size: 1 } }])
    .toArray();
  if (!squad) {
    await col.updateOne({ _id }, { $set: { status: "expired" } });
    return { status: "expired", ticketId: id };
  }
  const ghost: H2HSide = {
    username: squad.username,
    overall: squad.overall,
    chemistry: squad.chemistry,
    formation: squad.formation,
    xi: squad.players.map((p) => ({ name: p.name, position: p.role, rating: p.rating })),
    factor: 0.92 + (0.16 * squad.chemistry) / 100,
  };
  const views = play(ticket.side, ghost, [id, id], true);
  await col.updateOne({ _id }, { $set: { match: views.a } });
  return views.a;
}
