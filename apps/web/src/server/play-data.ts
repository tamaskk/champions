import "server-only";

import {
  dailyChecks,
  dailyScore,
  decadeLabel,
  DECADES,
  LEAGUE_ADJECTIVES,
  legendById,
  matchReport,
  playMatch,
  savedSquadSide,
  scoreOf,
  sideFromLineup,
  simulateTournament,
  PlayError,
  todayKey,
  type League,
  type MatchSide,
  type PlayRequest,
  type PlayResponse,
  type SecondChanceResponse,
  type SquadResult,
  type TournamentData,
} from "@champion/shared";
import { ObjectId, type WithId } from "mongodb";

import { dailyChallenge } from "./daily-data";
import { dailyScores, miniLeagues, savedSquads, type SavedSquadDoc } from "./db";
import { BadRequest, userOf, verifySquad } from "./leaderboard-data";
import { legendXI } from "./legends-data";
import { notifyBeaten } from "./push-data";
import { cupField, opponentXI, seasonXIs } from "./match-data";
import { leagueTable } from "./table-data";
import { consumeItem } from "./wallet-data";

// Tournaments played on the server: the app only chooses (league, season, opponent…); the squad is
// the saved one (players checked against the database), the random numbers are the server's, and
// the result is stored on the squad. A squad plays 1 tournament plus one per Second chance.

const oid = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);
const cleanName = (x: unknown) =>
  typeof x === "string" && x.trim() ? x.replace(/\s+/g, " ").trim().slice(0, 30) : "Your XI";

export async function ownSquad(id: string, userId: string) {
  const _id = oid(id);
  if (!_id) throw new BadRequest("squad id");
  const doc = await (await savedSquads()).findOne({ _id, userId });
  if (!doc) throw new BadRequest("Not your squad");
  return doc;
}

/** Your side for the engine, built from the saved squad (ratings, positions, careers from the DB). */
export async function yourSide(doc: WithId<SavedSquadDoc>, teamName: string): Promise<MatchSide> {
  const v = await verifySquad(doc.formation, doc.players, doc.bench ?? []);
  return sideFromLineup(teamName, doc.formation, v.lineup, v.benchLineup);
}

/** Takes one of the squad's tournaments (atomically), or refuses when none is left. */
export async function claimPlay(_id: ObjectId) {
  const r = await (await savedSquads()).updateOne(
    { _id, $expr: { $lt: [{ $ifNull: ["$plays", 0] }, { $add: [1, { $ifNull: ["$extraPlays", 0] }] }] } },
    { $inc: { plays: 1 } },
  );
  if (r.modifiedCount === 0) {
    throw new BadRequest("This squad has played its tournament – use a Second chance or draft a new XI");
  }
}
const releasePlay = async (_id: ObjectId) => (await savedSquads()).updateOne({ _id }, { $inc: { plays: -1 } });

export async function storeResult(_id: ObjectId, report: SquadResult) {
  await (await savedSquads()).updateOne(
    { _id },
    { $push: { results: { $each: [{ ...report, at: new Date().toISOString() }], $slice: -20 } } },
  );
}

export async function playTournament(squadId: string, body: PlayRequest | null): Promise<PlayResponse> {
  if (!body) throw new BadRequest("JSON body expected");
  const user = await userOf(body.userId);
  const doc = await ownSquad(squadId, user.userId);
  const teamName = cleanName(body.teamName);

  // The Daily keeps its own "first result counts" rule (one per day), shown again if asked twice.
  if (body.mode === "daily") return playDaily(doc, user.userId, teamName, body.date);

  await claimPlay(doc._id);
  try {
    const you = await yourSide(doc, teamName);
    const response = await simulate(body, you, { userId: user.userId, username: user.username });
    await storeResult(doc._id, response.report);
    return response;
  } catch (error) {
    await releasePlay(doc._id);
    throw error;
  }
}

async function simulate(body: PlayRequest, you: MatchSide, player: { userId: string; username: string }): Promise<PlayResponse> {
  if (body.mode === "challenge") {
    const _id = oid(String(body.opponentSquadId));
    const opp = _id ? await (await savedSquads()).findOne({ _id }) : null;
    if (!opp) throw new BadRequest("That squad doesn't exist");
    const played = playMatch(you, savedSquadSide(opp));
    const { yours, theirs, outcome } = scoreOf(played);
    if (outcome === "win") notifyBeaten(opp.userId, player.userId, player.username, `${yours}–${theirs}`);
    return { mode: "challenge", played, report: matchReport(played, `Challenge vs @${opp.username}`) };
  }
  if (body.mode === "daily") throw new BadRequest("mode");
  // Match, legend, league and cup: the same code the app runs offline, with the database's clubs.
  try {
    return await simulateTournament(body, you, DATABASE);
  } catch (error) {
    if (error instanceof PlayError) throw new BadRequest(error.message);
    throw error;
  }
}

const DATABASE: TournamentData = { opponentXI, leagueTable, seasonXIs, cupField, legendXI };

// ---- The Daily: rules checked, targets from the verified squad, the legend match on the server.

const decadeOf = (label: string) => DECADES.find((d) => decadeLabel(d) === label || String(d) === label) ?? null;
const leagueOfLabel = (label: string) =>
  (Object.keys(LEAGUE_ADJECTIVES) as League[]).find((l) => LEAGUE_ADJECTIVES[l] === label || l === label) ?? null;

function yesterday(today: string) {
  return new Date(new Date(`${today}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
}

async function playDaily(
  doc: WithId<SavedSquadDoc>,
  userId: string,
  teamName: string,
  date: unknown,
): Promise<PlayResponse> {
  const today = todayKey();
  if (typeof date !== "string" || (date !== today && date !== yesterday(today))) throw new BadRequest("date");
  const { challenge } = await dailyChallenge(date);
  const rules = challenge.rules;
  const col = await dailyScores();
  const leagues = await (await miniLeagues()).countDocuments({ members: userId });
  const title = `Daily ${date}: ${challenge.title}`;

  const earlier = await col.findOne({ userId, date });
  if (earlier) {
    const checks = earlier.checks ?? [];
    return {
      mode: "daily",
      challenge,
      played: earlier.played ?? null,
      checks,
      success: earlier.success,
      score: earlier.score,
      counted: false,
      leagues,
      report: { mode: "daily", title, detail: `${checks.filter((c) => c.ok).length}/${checks.length} targets`, outcome: earlier.success ? "win" : "loss" },
    };
  }

  if (rules.formation && doc.formation !== rules.formation) throw new BadRequest("This squad doesn't use the day's formation");
  for (const p of doc.players) {
    const decade = decadeOf(p.decade);
    const league = leagueOfLabel(p.league);
    if (rules.decades?.length && (!decade || !rules.decades.includes(decade))) throw new BadRequest("A player is from a decade the Daily doesn't allow");
    if (rules.leagues?.length && (!league || !rules.leagues.includes(league))) throw new BadRequest("A player is from a league the Daily doesn't allow");
  }

  const you = await yourSide(doc, teamName);
  let played = null;
  if (rules.opponentLegend) {
    const legend = legendById(rules.opponentLegend);
    const xi = legend ? await legendXI(legend.id) : null;
    if (legend && xi && xi.xi.length) played = playMatch(you, { name: legend.nickname, xi: xi.xi, factor: 1 });
  }
  const s = played ? scoreOf(played) : null;
  const outcome = {
    overall: doc.overall,
    chemistry: doc.chemistry,
    match: rules.opponentLegend ? (s ? { yours: s.yours, theirs: s.theirs } : null) : undefined,
  };
  const checks = dailyChecks(challenge, outcome);
  const { score, success } = dailyScore(challenge, outcome);
  const res = await col.updateOne(
    { userId, date },
    {
      $setOnInsert: {
        userId,
        date,
        challengeId: challenge.id,
        score,
        success,
        overall: doc.overall,
        chemistry: doc.chemistry,
        createdAt: new Date(),
        played,
        checks,
      },
    },
    { upsert: true },
  );
  if (res.upsertedCount === 0) return playDaily(doc, userId, teamName, date); // a parallel request won
  const report: SquadResult = {
    mode: "daily",
    title,
    detail: `${checks.filter((c) => c.ok).length}/${checks.length} targets`,
    outcome: success ? "win" : "loss",
  };
  await storeResult(doc._id, report);
  return { mode: "daily", challenge, played, checks, success, score, counted: true, leagues, report };
}

// ---- Second chance: one more tournament for this squad (uses the wallet item).

export async function secondChance(
  squadId: string,
  body: { userId?: string; requestId?: string } | null,
): Promise<SecondChanceResponse> {
  const user = await userOf(body?.userId);
  const doc = await ownSquad(squadId, user.userId);
  const allowed = 1 + (doc.extraPlays ?? 0);
  if ((doc.plays ?? 0) < allowed) return { ok: true, plays: doc.plays ?? 0, allowed };
  const spent = await consumeItem({ userId: user.userId, itemId: "second-chance", requestId: body?.requestId });
  if (!spent.ok) return { ok: false, plays: doc.plays ?? 0, allowed, reason: spent.reason ?? "No Second chance left" };
  await (await savedSquads()).updateOne({ _id: doc._id }, { $inc: { extraPlays: 1 } });
  return { ok: true, plays: doc.plays ?? 0, allowed: allowed + 1 };
}

/** Puts a squad that was saved only to play onto the public leaderboard. */
export async function listSquad(squadId: string, body: { userId?: string } | null): Promise<{ ok: true }> {
  const user = await userOf(body?.userId);
  const doc = await ownSquad(squadId, user.userId);
  await (await savedSquads()).updateOne({ _id: doc._id }, { $set: { listed: true } });
  return { ok: true };
}
