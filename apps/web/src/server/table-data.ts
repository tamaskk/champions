import "server-only";

import { lastCompleteSeason, type League, type LeagueTableRow } from "@champion/shared";

import { clubSeasons } from "./db";

/** Final table of a league season, top to bottom. Clubs without a saved table are left out. */
export async function leagueTable(league: League, season: number): Promise<LeagueTableRow[]> {
  const rows = await (await clubSeasons())
    .find(
      { league, season, table: { $type: "object" } },
      { projection: { _id: 0, club: 1, clubSlug: 1, table: 1, elo: 1 } },
    )
    .toArray();
  return rows
    .map((r) => ({ ...r.table!, club: r.club, clubSlug: r.clubSlug, elo: r.elo ?? null }))
    .sort((a, b) => a.position - b.position);
}

/** A random completed league season that has a table (1960 … last finished season). */
export async function randomLeagueSeason(): Promise<{ league: League; season: number } | null> {
  const [pick] = await (await clubSeasons())
    .aggregate<{ league: League; season: number }>([
      { $match: { table: { $type: "object" }, season: { $gte: 1960, $lte: lastCompleteSeason() } } },
      { $sample: { size: 1 } },
      { $project: { _id: 0, league: 1, season: 1 } },
    ])
    .toArray();
  return pick ?? null;
}
