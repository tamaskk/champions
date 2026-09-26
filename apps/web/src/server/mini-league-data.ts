import "server-only";

import {
  MINI_LEAGUE,
  dailyScore,
  normalizeLeagueCode,
  todayKey,
  weekDates,
  type DailyScoreRequest,
  type DailyScoreResponse,
  type MiniLeagueDetail,
  type MiniLeagueStanding,
  type MiniLeaguesResponse,
} from "@champion/shared";
import { ObjectId, type WithId } from "mongodb";
import { randomInt } from "node:crypto";

import { dailyChallenge } from "./daily-data";
import { dailyScores, miniLeagues, users, type MiniLeagueDoc } from "./db";
import { BadRequest, userOf } from "./leaderboard-data";

// Mini-leagues: private groups joined with an invite code; the table is the week's Daily
// Challenge points. The userId (the device's secret) identifies the caller; other members are only
// ever shown by username.

const num = (x: unknown, lo: number, hi: number) =>
  typeof x === "number" && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null;
const isDate = (x: unknown): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);

function yesterday(today: string) {
  return new Date(new Date(`${today}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
}

/**
 * A Daily result from the app. The score is recomputed here from the day's real challenge (never
 * taken from the client), only for today or yesterday (a draft that ran past midnight), and only
 * the first result of a day counts.
 */
export async function submitDailyScore(body: DailyScoreRequest | null): Promise<DailyScoreResponse> {
  if (!body) throw new BadRequest("JSON body expected");
  const user = await userOf(body.userId);
  const today = todayKey();
  if (!isDate(body.date) || (body.date !== today && body.date !== yesterday(today))) throw new BadRequest("date");
  const { challenge } = await dailyChallenge(body.date);
  if (body.challengeId !== challenge.id) throw new BadRequest("challengeId");

  const o = body.outcome ?? ({} as DailyScoreRequest["outcome"]);
  const overall = num(o.overall, 0, 100);
  const chemistry = num(o.chemistry, 0, 100);
  if (overall === null || chemistry === null) throw new BadRequest("outcome");
  const match =
    o.match && num(o.match.yours, 0, 20) !== null && num(o.match.theirs, 0, 20) !== null
      ? { yours: Math.round(o.match.yours), theirs: Math.round(o.match.theirs) }
      : null;
  const { score, success } = dailyScore(challenge, { overall, chemistry: Math.round(chemistry), match });

  const col = await dailyScores();
  const res = await col.updateOne(
    { userId: user.userId, date: body.date },
    {
      $setOnInsert: {
        userId: user.userId,
        date: body.date,
        challengeId: challenge.id,
        score,
        success,
        overall,
        chemistry: Math.round(chemistry),
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
  const leagues = await (await miniLeagues()).countDocuments({ members: user.userId });
  if (res.upsertedCount === 0) {
    const first = await col.findOne({ userId: user.userId, date: body.date });
    return { score: first?.score ?? score, success: first?.success ?? success, counted: false, leagues };
  }
  return { score, success, counted: true, leagues };
}

async function newCode(): Promise<string> {
  const { codeAlphabet, codeLength } = MINI_LEAGUE;
  return Array.from({ length: codeLength }, () => codeAlphabet[randomInt(codeAlphabet.length)]).join("");
}

async function checkRoom(userId: string) {
  const count = await (await miniLeagues()).countDocuments({ members: userId });
  if (count >= MINI_LEAGUE.maxPerUser) throw new BadRequest(`You can be in ${MINI_LEAGUE.maxPerUser} leagues at most`);
}

/** Your place and points in each of your leagues this week. */
async function summaries(userId: string, leagues: WithId<MiniLeagueDoc>[]): Promise<MiniLeaguesResponse> {
  const dates = weekDates(todayKey());
  const everyone = [...new Set(leagues.flatMap((l) => l.members))];
  const scores = await (await dailyScores())
    .find({ userId: { $in: everyone }, date: { $in: dates } }, { projection: { userId: 1, score: 1 } })
    .toArray();
  const points = new Map<string, number>();
  for (const s of scores) points.set(s.userId, (points.get(s.userId) ?? 0) + s.score);
  return {
    leagues: leagues.map((l) => {
      const mine = points.get(userId) ?? 0;
      return {
        id: l._id.toHexString(),
        name: l.name,
        code: l.code,
        members: l.members.length,
        owner: l.ownerId === userId,
        rank: 1 + l.members.filter((m) => (points.get(m) ?? 0) > mine).length,
        points: mine,
      };
    }),
  };
}

export async function myMiniLeagues(body: { userId?: string } | null): Promise<MiniLeaguesResponse> {
  const user = await userOf(body?.userId);
  const leagues = await (await miniLeagues()).find({ members: user.userId }).sort({ createdAt: 1 }).toArray();
  return summaries(user.userId, leagues);
}

export async function createMiniLeague(body: { userId?: string; name?: string } | null): Promise<MiniLeaguesResponse> {
  const user = await userOf(body?.userId);
  const name = typeof body?.name === "string" ? body.name.replace(/\s+/g, " ").trim().slice(0, MINI_LEAGUE.nameMax) : "";
  if (name.length < 2) throw new BadRequest("Give your league a name (2+ letters)");
  await checkRoom(user.userId);
  const col = await miniLeagues();
  for (let tries = 0; tries < 8; tries++) {
    try {
      await col.insertOne({
        name,
        code: await newCode(),
        ownerId: user.userId,
        members: [user.userId],
        createdAt: new Date(),
      });
      return myMiniLeagues({ userId: user.userId });
    } catch (error) {
      // Code taken (unique index): draw another.
      if (!(error instanceof Error && "code" in error && (error as { code: unknown }).code === 11000)) throw error;
    }
  }
  throw new Error("Could not generate a free league code");
}

export async function joinMiniLeague(body: { userId?: string; code?: string } | null): Promise<MiniLeaguesResponse> {
  const user = await userOf(body?.userId);
  const code = normalizeLeagueCode(typeof body?.code === "string" ? body.code : "");
  if (code.length !== MINI_LEAGUE.codeLength) throw new BadRequest(`League codes have ${MINI_LEAGUE.codeLength} characters`);
  const col = await miniLeagues();
  const league = await col.findOne({ code });
  if (!league) throw new BadRequest("No league with that code");
  if (!league.members.includes(user.userId)) {
    if (league.members.length >= MINI_LEAGUE.maxMembers) throw new BadRequest("That league is full");
    await checkRoom(user.userId);
    // Only while there is room (two joins at once can't overfill it).
    const res = await col.updateOne(
      { _id: league._id, [`members.${MINI_LEAGUE.maxMembers - 1}`]: { $exists: false } },
      { $addToSet: { members: user.userId } },
    );
    if (res.matchedCount === 0) throw new BadRequest("That league is full");
  }
  return myMiniLeagues({ userId: user.userId });
}

async function memberLeague(userId: string, id: unknown) {
  if (typeof id !== "string" || !ObjectId.isValid(id)) throw new BadRequest("id");
  const league = await (await miniLeagues()).findOne({ _id: new ObjectId(id), members: userId });
  if (!league) throw new BadRequest("Not a member of this league");
  return league;
}

/** Leaving: the owner's role passes to the longest-standing member; the last one out deletes it. */
export async function leaveMiniLeague(body: { userId?: string; id?: string } | null): Promise<MiniLeaguesResponse> {
  const user = await userOf(body?.userId);
  const league = await memberLeague(user.userId, body?.id);
  const rest = league.members.filter((m) => m !== user.userId);
  const col = await miniLeagues();
  if (rest.length === 0) await col.deleteOne({ _id: league._id });
  else
    await col.updateOne(
      { _id: league._id },
      { $pull: { members: user.userId }, $set: { ownerId: league.ownerId === user.userId ? rest[0]! : league.ownerId } },
    );
  return myMiniLeagues({ userId: user.userId });
}

/** The week's table of one league (members by username only). */
export async function miniLeagueDetail(
  body: { userId?: string; id?: string; week?: string } | null,
): Promise<MiniLeagueDetail> {
  const user = await userOf(body?.userId);
  const league = await memberLeague(user.userId, body?.id);
  const today = todayKey();
  const dates = weekDates(isDate(body?.week) ? body.week : today);
  const [members, scores] = await Promise.all([
    (await users()).find({ userId: { $in: league.members } }, { projection: { userId: 1, username: 1 } }).toArray(),
    (await dailyScores())
      .find({ userId: { $in: league.members }, date: { $in: dates } }, { projection: { userId: 1, date: 1, score: 1, success: 1 } })
      .toArray(),
  ]);
  const standings: MiniLeagueStanding[] = members.map((m) => {
    const mine = scores.filter((s) => s.userId === m.userId);
    const on = (d: string) => mine.find((s) => s.date === d);
    return {
      username: m.username,
      you: m.userId === user.userId,
      points: mine.reduce((n, s) => n + s.score, 0),
      played: mine.length,
      days: dates.map((d) => on(d)?.score ?? null),
      success: dates.map((d) => on(d)?.success ?? null),
    };
  });
  standings.sort((a, b) => b.points - a.points || b.played - a.played || a.username.localeCompare(b.username));
  return {
    id: league._id.toHexString(),
    name: league.name,
    code: league.code,
    owner: league.ownerId === user.userId,
    members: league.members.length,
    dates,
    today,
    standings,
  };
}
