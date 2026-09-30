import "server-only";

import {
  H2H_WAIT_SECONDS,
  matchEvents,
  simulateMatch,
  type H2HMatched,
  type H2HQueueRequest,
  type H2HSide,
  type H2HTicket,
  type MatchSide,
  type SquadResult,
} from "@champion/shared";
import { ObjectId, type WithId } from "mongodb";

import { h2hTickets, savedSquads, type H2HTicketDoc, type SavedSquadDoc } from "./db";
import { BadRequest, userOf } from "./leaderboard-data";
import { claimPlay, ownSquad, storeResult, yourSide } from "./play-data";

const oid = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);
const waitLimit = () => new Date(Date.now() - H2H_WAIT_SECONDS * 1000);

/** The player's side, built by the server from the saved squad (never from numbers the app sends). */
async function squadSide(squadId: unknown, userId: string, username: string): Promise<H2HSide> {
  if (typeof squadId !== "string") throw new BadRequest("squadId");
  const doc = await ownSquad(squadId, userId);
  if ((doc.plays ?? 0) >= 1 + (doc.extraPlays ?? 0)) {
    throw new BadRequest("This squad has played its tournament – use a Second chance or draft a new XI");
  }
  const side = await yourSide(doc, `@${username}`);
  return {
    username,
    overall: doc.overall,
    chemistry: doc.chemistry,
    formation: doc.formation,
    xi: side.xi,
    factor: side.factor ?? 1,
  };
}

/** Stores a head-to-head result on the squad that played it (and uses up its tournament). */
async function recordResult(squadId: string | undefined, match: H2HMatched) {
  const _id = squadId && ObjectId.isValid(squadId) ? new ObjectId(squadId) : null;
  if (!_id) return;
  const yours = match.youAtHome ? match.result.homeGoals : match.result.awayGoals;
  const theirs = match.youAtHome ? match.result.awayGoals : match.result.homeGoals;
  const report: SquadResult = {
    mode: "h2h",
    title: `Head-to-head vs @${match.opponent.username}${match.opponent.ghost ? " (saved XI)" : ""}`,
    detail: `${yours}–${theirs}`,
    outcome: yours > theirs ? "win" : yours === theirs ? "draw" : "loss",
  };
  try {
    await claimPlay(_id);
    await storeResult(_id, report);
  } catch {
    // The squad used its tournament elsewhere in the meantime: the match stands, no result is stored.
  }
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
  const side = await squadSide(body.squadId, user.userId, user.username);
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
    await col.insertOne({ _id, userId: user.userId, squadId: body.squadId, side, status: "waiting", createdAt });
    return { status: "waiting", ticketId: _id.toHexString(), since: createdAt.toISOString() };
  }
  const views = play(side, opponent.side, [_id.toHexString(), opponent._id.toHexString()]);
  await col.insertOne({ _id, userId: user.userId, squadId: body.squadId, side, status: "matched", createdAt: new Date(), match: views.a });
  await col.updateOne({ _id: opponent._id }, { $set: { match: views.b } });
  await recordResult(body.squadId, views.a);
  await recordResult(opponent.squadId, views.b);
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
    .aggregate<WithId<SavedSquadDoc>>([{ $match: { userId: { $ne: userId }, listed: { $ne: false } } }, { $sample: { size: 1 } }])
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
  await recordResult(ticket.squadId, views.a);
  return views.a;
}
