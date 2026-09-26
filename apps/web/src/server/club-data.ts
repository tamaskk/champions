import "server-only";

import { DECADES, LEAGUES, type ClubSeason, type League } from "@champion/shared";
import { ObjectId, type Filter } from "mongodb";

import { clubSeasons, importLogs, type ClubSeasonDoc } from "./db";

export type CoverageCell = { league: League; decade: number; clubs: number; seasons: number };

export async function getDashboardData() {
  const [col, logs] = await Promise.all([clubSeasons(), importLogs()]);

  const [total, clubKeys, seasons, coverage, byLeague, latest, recentImports] = await Promise.all([
    col.countDocuments(),
    col.aggregate<{ n: number }>([{ $group: { _id: { l: "$league", c: "$clubSlug" } } }, { $count: "n" }]).toArray(),
    col.distinct("season"),
    col
      .aggregate<{ _id: { league: League; decade: number }; clubs: string[]; seasons: number[] }>([
        {
          $group: {
            _id: { league: "$league", decade: "$decade" },
            clubs: { $addToSet: "$clubSlug" },
            seasons: { $addToSet: "$season" },
          },
        },
      ])
      .toArray(),
    col.aggregate<{ _id: League; n: number }>([{ $group: { _id: "$league", n: { $sum: 1 } } }]).toArray(),
    col.find().sort({ updatedAt: -1 }).limit(6).toArray(),
    logs.find().sort({ createdAt: -1 }).limit(5).toArray(),
  ]);

  const cells: CoverageCell[] = coverage.map((c) => ({
    league: c._id.league,
    decade: c._id.decade,
    clubs: c.clubs.length,
    seasons: c.seasons.length,
  }));

  return {
    total,
    clubs: clubKeys[0]?.n ?? 0,
    seasons: seasons.length,
    leaguesCovered: byLeague.length,
    cells,
    byLeague: LEAGUES.map((league) => ({ league, count: byLeague.find((b) => b._id === league)?.n ?? 0 })),
    latest,
    recentImports,
  };
}

export const CLUB_SORT_KEYS = ["club", "league", "season", "decade", "players", "source"] as const;
export type ClubSortKey = (typeof CLUB_SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

export type ClubFilters = {
  league?: League;
  decade?: number;
  season?: number;
  q?: string;
  sort?: ClubSortKey;
  dir?: SortDir;
  page?: number;
};

export const CLUB_PAGE_SIZE = 50;

export async function listClubSeasons(filters: ClubFilters) {
  const col = await clubSeasons();
  const query: Filter<ClubSeasonDoc> = {};
  if (filters.league) query.league = filters.league;
  if (filters.decade) query.decade = filters.decade;
  if (filters.season) query.season = filters.season;
  if (filters.q) {
    query.club = { $regex: filters.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  }

  // Default order: league, newest season, club. A chosen column sorts first; club, then newest
  // season break ties (only added if not already the chosen column, so its direction is kept).
  const sort: Record<string, 1 | -1> = filters.sort
    ? { [filters.sort]: filters.dir === "desc" ? -1 : 1 }
    : { league: 1, season: -1 };
  sort.club ??= 1;
  sort.season ??= -1;

  const count = await col.countDocuments(query);
  const pages = Math.max(1, Math.ceil(count / CLUB_PAGE_SIZE));
  const page = Math.min(filters.page ?? 1, pages);

  // Squad size, so the list can show and sort by it.
  const withSquadSize = [
    {
      $lookup: {
        from: "squadPlayers",
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
          { $count: "n" },
        ],
        as: "squad",
      },
    },
    { $addFields: { players: { $ifNull: [{ $first: "$squad.n" }, 0] } } },
    { $project: { squad: 0 } },
  ];
  const pageStages = [{ $sort: sort }, { $skip: (page - 1) * CLUB_PAGE_SIZE }, { $limit: CLUB_PAGE_SIZE }];

  const rows = await col
    .aggregate<ClubSeasonDoc & { _id: ObjectId; players: number }>(
      [
        { $match: query },
        // Sorting by squad size needs it for every row; otherwise count only the visible page.
        ...(filters.sort === "players" ? [...withSquadSize, ...pageStages] : [...pageStages, ...withSquadSize]),
      ],
      // Locale-aware order, so "Évian" sorts with E, not after Z.
      { collation: { locale: "en" } },
    )
    .toArray();

  return { rows, count, page, pages };
}

export async function saveClubSeasons(rows: ClubSeason[], fileName: string | null) {
  const col = await clubSeasons();
  const now = new Date();

  const result = await col.bulkWrite(
    rows.map((row) => ({
      updateOne: {
        filter: { league: row.league, season: row.season, clubSlug: row.clubSlug },
        update: {
          $set: { club: row.club, decade: row.decade, source: row.source, updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  // updatedAt always changes, so modifiedCount can't tell real edits apart; report new vs existing.
  const summary = { rows: rows.length, inserted: result.upsertedCount, existing: result.matchedCount };

  // reduce, not Math.min(...), so large imports don't overflow the call stack.
  const seasonFrom = rows.reduce((min, r) => Math.min(min, r.season), Infinity);
  const seasonTo = rows.reduce((max, r) => Math.max(max, r.season), -Infinity);
  await (await importLogs()).insertOne({
    createdAt: now,
    fileName,
    rows: summary.rows,
    inserted: summary.inserted,
    existing: summary.existing,
    leagues: [...new Set(rows.map((r) => r.league))].sort(),
    seasonFrom,
    seasonTo,
  });

  return summary;
}

export async function deleteClubSeason(id: string) {
  if (!ObjectId.isValid(id)) return;
  await (await clubSeasons()).deleteOne({ _id: new ObjectId(id) });
}

export function parseClubFilters(params: Record<string, string | string[] | undefined>): ClubFilters {
  const one = (key: string) => {
    const v = params[key];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const league = one("league");
  const decade = Number(one("decade"));
  const season = Number(one("season"));
  return {
    league: (LEAGUES as readonly string[]).includes(league ?? "") ? (league as League) : undefined,
    decade: (DECADES as readonly number[]).includes(decade) ? decade : undefined,
    season: Number.isInteger(season) && season > 0 ? season : undefined,
    q: one("q"),
    sort: (CLUB_SORT_KEYS as readonly string[]).includes(one("sort") ?? "") ? (one("sort") as ClubSortKey) : undefined,
    dir: one("dir") === "desc" ? "desc" : "asc",
    page: Math.max(1, Math.floor(Number(one("page"))) || 1),
  };
}

/** Distinct clubs of a league in a decade, most seasons first. */
export async function clubsInDecade(league: League, decade: number) {
  const col = await clubSeasons();
  return col
    .aggregate<{ club: string; clubSlug: string; seasons: number }>([
      { $match: { league, decade } },
      { $sort: { season: -1 } },
      { $group: { _id: "$clubSlug", club: { $first: "$club" }, seasons: { $sum: 1 } } },
      { $project: { _id: 0, clubSlug: "$_id", club: 1, seasons: 1 } },
      { $sort: { seasons: -1, club: 1 } },
    ])
    .toArray();
}
