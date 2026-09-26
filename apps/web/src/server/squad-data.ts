import "server-only";

import { PLAYER_ROLES, type ChemistryProfile, type ClubStint, type League, type SquadPlayer, type SquadResponse, type PlayerCareer, slugify, type SearchResponse } from "@champion/shared";
import { ObjectId } from "mongodb";

import { clubSeasons, squadPlayers, type SquadPlayerDoc } from "./db";

export async function getClubSeason(id: string) {
  if (!ObjectId.isValid(id)) return null;
  return (await clubSeasons()).findOne({ _id: new ObjectId(id) });
}

/** Squad of one club-season, ordered GK, DF, MF, FW, then by appearances. */
export async function listSquad(league: string, season: number, clubSlug: string) {
  const rows = await (await squadPlayers()).find({ league: league as SquadPlayer["league"], season, clubSlug }).toArray();
  const order = [...PLAYER_ROLES].reverse();
  return rows.sort(
    (a, b) =>
      order.indexOf(a.position) - order.indexOf(b.position) ||
      (b.appearances ?? -1) - (a.appearances ?? -1) ||
      a.name.localeCompare(b.name),
  );
}

export async function saveSquad(players: SquadPlayer[]) {
  const now = new Date();
  const result = await (await squadPlayers()).bulkWrite(
    players.map(({ league, season, clubSlug, nameSlug, ...rest }) => ({
      updateOne: {
        filter: { league, season, clubSlug, nameSlug },
        update: { $set: { ...rest, updatedAt: now }, $setOnInsert: { createdAt: now } },
        upsert: true,
      },
    })),
    { ordered: false },
  );
  return { inserted: result.upsertedCount, existing: result.matchedCount };
}

export async function deleteSquadPlayer(id: string) {
  if (!ObjectId.isValid(id)) return;
  await (await squadPlayers()).deleteOne({ _id: new ObjectId(id) });
}

/**
 * A club's players across all imported seasons of a decade, one entry per player: stats summed,
 * position from their latest season, decade rating, best rated first.
 */
export async function squadInDecade(league: League, decade: number, clubSlug: string) {
  const players = await (await squadPlayers())
    .aggregate<Omit<SquadResponse["players"][number], "chemistry">>([
      { $match: { league, clubSlug, season: { $gte: decade, $lte: decade + 9 } } },
      { $sort: { season: -1 } },
      {
        $group: {
          _id: "$nameSlug",
          name: { $first: "$name" },
          position: { $first: "$position" },
          positions: { $first: "$positions" },
          tmPlayerId: { $first: "$tmPlayerId" },
          nationality: { $first: "$nationality" },
          seasons: { $push: "$season" },
          appearances: { $sum: "$appearances" },
          goals: { $sum: "$goals" },
          // Same value on every season of the player's club decade.
          rating: { $max: "$decadeRating" },
          knownApps: { $sum: { $cond: [{ $eq: ["$appearances", null] }, 0, 1] } },
        },
      },
      {
        $project: {
          _id: 0,
          nameSlug: "$_id",
          name: 1,
          position: 1,
          nationality: 1,
          seasons: 1,
          // $sum treats null as 0; keep null when no season had the number.
          appearances: { $cond: [{ $gt: ["$knownApps", 0] }, "$appearances", null] },
          goals: 1,
          rating: 1,
          positions: { $ifNull: ["$positions", []] },
          tmPlayerId: { $ifNull: ["$tmPlayerId", null] },
        },
      },
      { $sort: { rating: -1, appearances: -1, name: 1 } },
    ])
    .toArray();
  const careers = await chemistryProfiles(players.flatMap((p) => (p.tmPlayerId ? [p.tmPlayerId] : [])));
  return players.map((p) => ({ ...p, chemistry: (p.tmPlayerId && careers.get(p.tmPlayerId)) || null }));
}

/**
 * Whole careers (every top-five-league season he played in, nationalities) of the given players,
 * for chemistry. One indexed query: ~50 players × ~15 seasons.
 */
export async function chemistryProfiles(tmPlayerIds: number[]): Promise<Map<number, ChemistryProfile>> {
  if (tmPlayerIds.length === 0) return new Map();
  const rows = await (await squadPlayers())
    .find(
      { tmPlayerId: { $in: tmPlayerIds }, appearances: { $gt: 0 } },
      { projection: { _id: 0, tmPlayerId: 1, league: 1, clubSlug: 1, season: 1, nationality: 1, nationalities: 1 } },
    )
    .sort({ season: -1 })
    .toArray();
  const out = new Map<number, ChemistryProfile & { byClub: Map<string, ClubStint> }>();
  for (const r of rows) {
    const id = r.tmPlayerId!;
    let profile = out.get(id);
    if (!profile) {
      // Latest season first: its nationalities are the current ones.
      const nationalities = r.nationalities?.length ? r.nationalities : r.nationality ? [r.nationality] : [];
      profile = { nationalities, clubs: [], byClub: new Map() };
      out.set(id, profile);
    }
    const key = `${r.league}|${r.clubSlug}`;
    let stint = profile.byClub.get(key);
    if (!stint) {
      stint = { league: r.league, clubSlug: r.clubSlug, seasons: [] };
      profile.byClub.set(key, stint);
      profile.clubs.push(stint);
    }
    stint.seasons.unshift(r.season);
  }
  return new Map([...out].map(([id, { nationalities, clubs }]) => [id, { nationalities, clubs }]));
}

/** A player's career across all imported seasons (by Transfermarkt id, else by name slug). */
export async function playerCareer(by: { tmPlayerId?: number; nameSlug?: string }): Promise<PlayerCareer | null> {
  const match = by.tmPlayerId ? { tmPlayerId: by.tmPlayerId } : by.nameSlug ? { nameSlug: by.nameSlug } : null;
  if (!match) return null;
  const rows = await (await squadPlayers())
    .aggregate<SquadPlayerDoc & { club: string | null }>([
      { $match: match },
      { $sort: { season: 1, league: 1 } },
      {
        $lookup: {
          from: "clubSeasons",
          let: { league: "$league", season: "$season", clubSlug: "$clubSlug" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$league", "$$league"] },
                    { $eq: ["$season", "$$season"] },
                    { $eq: ["$clubSlug", "$$clubSlug"] },
                  ],
                },
              },
            },
            { $project: { club: 1 } },
          ],
          as: "cs",
        },
      },
      { $addFields: { club: { $first: "$cs.club" } } },
      { $project: { cs: 0 } },
    ])
    .toArray();
  if (!rows.length) return null;
  const latest = rows[rows.length - 1];
  return {
    name: latest.name,
    nationality: latest.nationality ?? null,
    birthYear: latest.birthYear ?? null,
    positions: latest.positions ?? [],
    seasons: rows.map((r) => ({
      league: r.league,
      season: r.season,
      clubSlug: r.clubSlug,
      club: r.club ?? r.clubSlug,
      position: r.position,
      appearances: r.appearances ?? null,
      goals: r.goals ?? null,
      rating: r.rating ?? null,
    })),
  };
}

const SEARCH_LIMIT = { players: 20, clubs: 8 };

/** Players and clubs whose name contains `q` (compared as slugs, so accents don't matter). */
export async function search(q: string): Promise<SearchResponse> {
  const slug = slugify(q);
  if (slug.length < 2) return { players: [], clubs: [] };
  const pattern = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const [players, clubs] = await Promise.all([
    (await squadPlayers())
      .aggregate<SearchResponse["players"][number]>([
        { $match: { nameSlug: { $regex: pattern } } },
        { $sort: { season: -1 } },
        {
          $group: {
            // One entry per person: Transfermarkt id when known, else the name.
            _id: { $ifNull: ["$tmPlayerId", "$nameSlug"] },
            name: { $first: "$name" },
            nameSlug: { $first: "$nameSlug" },
            tmPlayerId: { $first: "$tmPlayerId" },
            position: { $first: "$position" },
            positions: { $first: "$positions" },
            nationality: { $first: "$nationality" },
            rating: { $max: "$decadeRating" },
            seasons: { $sum: 1 },
            clubSlug: { $first: "$clubSlug" },
            league: { $first: "$league" },
            to: { $max: "$season" },
            from: { $min: "$season" },
          },
        },
        { $sort: { rating: -1, seasons: -1 } },
        { $limit: SEARCH_LIMIT.players },
        {
          $lookup: {
            from: "clubSeasons",
            let: { league: "$league", season: "$to", clubSlug: "$clubSlug" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$league", "$$league"] },
                      { $eq: ["$season", "$$season"] },
                      { $eq: ["$clubSlug", "$$clubSlug"] },
                    ],
                  },
                },
              },
              { $project: { club: 1 } },
            ],
            as: "cs",
          },
        },
        {
          $project: {
            _id: 0,
            name: 1,
            nameSlug: 1,
            tmPlayerId: { $ifNull: ["$tmPlayerId", null] },
            position: 1,
            positions: { $ifNull: ["$positions", []] },
            nationality: { $ifNull: ["$nationality", null] },
            rating: { $ifNull: ["$rating", null] },
            seasons: 1,
            club: { $ifNull: [{ $first: "$cs.club" }, "$clubSlug"] },
            league: 1,
            from: 1,
            to: 1,
          },
        },
      ])
      .toArray(),
    (await clubSeasons())
      .aggregate<SearchResponse["clubs"][number]>([
        { $match: { clubSlug: { $regex: pattern } } },
        { $sort: { season: -1 } },
        {
          $group: {
            _id: "$clubSlug",
            club: { $first: "$club" },
            leagues: { $addToSet: "$league" },
            decades: { $addToSet: "$decade" },
            from: { $min: "$season" },
            to: { $max: "$season" },
            n: { $sum: 1 },
          },
        },
        { $sort: { n: -1 } },
        { $limit: SEARCH_LIMIT.clubs },
        { $project: { _id: 0, clubSlug: "$_id", club: 1, leagues: 1, decades: { $sortArray: { input: "$decades", sortBy: 1 } }, from: 1, to: 1 } },
      ])
      .toArray(),
  ]);
  return { players, clubs };
}
