import "server-only";

import { DECADES, LEAGUES, PLAYER_ROLES, POSITION_CODES, slugify, type League, type PlayerRole } from "@champion/shared";
import type { Filter, ObjectId } from "mongodb";

import { squadPlayers, type SquadPlayerDoc } from "./db";

export const PLAYER_SORT_KEYS = [
  "rating",
  "decadeRating",
  "name",
  "clubSlug",
  "league",
  "season",
  "position",
  "appearances",
  "goals",
] as const;
export type PlayerSortKey = (typeof PLAYER_SORT_KEYS)[number];

export type PlayerFilters = {
  q?: string;
  club?: string;
  league?: League;
  decade?: number;
  season?: number;
  role?: PlayerRole;
  code?: string;
  nat?: string;
  sort: PlayerSortKey;
  dir: "asc" | "desc";
  page: number;
};

export const PLAYER_PAGE_SIZE = 50;

const TEXT_SORTS = new Set<PlayerSortKey>(["name", "clubSlug", "league", "position"]);

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parsePlayerFilters(params: Record<string, string | string[] | undefined>): PlayerFilters {
  const one = (key: string) => {
    const v = params[key];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const league = one("league");
  const role = one("role");
  const code = one("code");
  const sort = one("sort");
  const decade = Number(one("decade"));
  const season = Number(one("season"));
  return {
    q: one("q"),
    club: one("club"),
    league: (LEAGUES as readonly string[]).includes(league ?? "") ? (league as League) : undefined,
    decade: (DECADES as readonly number[]).includes(decade) ? decade : undefined,
    season: Number.isInteger(season) && season > 0 ? season : undefined,
    role: (PLAYER_ROLES as readonly string[]).includes(role ?? "") ? (role as PlayerRole) : undefined,
    code: (POSITION_CODES as readonly string[]).includes(code ?? "") ? code : undefined,
    nat: one("nat")?.toUpperCase(),
    // Rating, best first, unless another column is chosen.
    sort: (PLAYER_SORT_KEYS as readonly string[]).includes(sort ?? "") ? (sort as PlayerSortKey) : "rating",
    dir: one("dir") === "asc" ? "asc" : one("dir") === "desc" ? "desc" : sort && sort !== "rating" ? "asc" : "desc",
    page: Math.max(1, Math.floor(Number(one("page"))) || 1),
  };
}

export async function listPlayers(filters: PlayerFilters) {
  const col = await squadPlayers();
  const query: Filter<SquadPlayerDoc> = {};
  if (filters.league) query.league = filters.league;
  if (filters.season) query.season = filters.season;
  else if (filters.decade) query.season = { $gte: filters.decade, $lte: filters.decade + 9 };
  if (filters.role) query.position = filters.role;
  if (filters.code) query.positions = filters.code;
  if (filters.nat) query.nationality = filters.nat;
  if (filters.q) query.name = { $regex: escapeRegex(filters.q), $options: "i" };
  if (filters.club && slugify(filters.club)) query.clubSlug = { $regex: `^${escapeRegex(slugify(filters.club))}` };

  // Unfiltered: the collection's metadata count is instant and exact enough; filtered: count.
  const count = Object.keys(query).length ? await col.countDocuments(query) : await col.estimatedDocumentCount();
  const pages = Math.max(1, Math.ceil(count / PLAYER_PAGE_SIZE));
  const page = Math.min(filters.page, pages);

  // Chosen column first, then rating (best first) and name as tie-breakers.
  const dir = filters.dir === "desc" ? -1 : 1;
  const sort: Record<string, 1 | -1> = { [filters.sort]: dir };
  if (filters.sort !== "rating") sort.rating = -1;
  if (filters.sort !== "name") sort.name = 1;

  const rows = await col
    .aggregate<SquadPlayerDoc & { _id: ObjectId; club: string | null; clubSeasonId: ObjectId | null }>(
      [
        { $match: query },
        { $sort: sort },
        { $skip: (page - 1) * PLAYER_PAGE_SIZE },
        { $limit: PLAYER_PAGE_SIZE },
        // Club display name and link, only for the visible page.
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
            as: "clubSeason",
          },
        },
        {
          $addFields: {
            club: { $first: "$clubSeason.club" },
            clubSeasonId: { $first: "$clubSeason._id" },
          },
        },
        { $project: { clubSeason: 0 } },
      ],
      // Locale-aware order for text columns ("Évian" with E). Numeric sorts skip it so they can
      // use the rating indexes, which have the default collation.
      TEXT_SORTS.has(filters.sort) ? { collation: { locale: "en" } } : {},
    )
    .toArray();

  return { rows, count, page, pages };
}
