import "server-only";

import { LEGENDS, legendById, type Legend, type LegendResponse } from "@champion/shared";

import { clubSeasons, squadPlayers } from "./db";
import { opponentXI } from "./match-data";

/** The club season a legend stands for: slug pattern in that league season, strongest (Elo) first. */
function pickClub(
  legend: Legend,
  candidates: { league: string; season: number; clubSlug: string; elo?: number | null }[],
) {
  const slug = new RegExp(legend.slug);
  const not = legend.notSlug ? new RegExp(legend.notSlug) : null;
  return (
    candidates
      .filter((c) => c.league === legend.league && c.season === legend.season)
      .filter((c) => slug.test(c.clubSlug) && !not?.test(c.clubSlug))
      .sort((a, b) => (b.elo ?? 0) - (a.elo ?? 0))[0] ?? null
  );
}

async function candidatesFor(legends: readonly Legend[]) {
  return (await clubSeasons())
    .find(
      { $or: legends.map((l) => ({ league: l.league, season: l.season })) },
      { projection: { _id: 0, league: 1, season: 1, clubSlug: 1, elo: 1 } },
    )
    .toArray();
}

/** A legendary club season's likely XI. */
export async function legendXI(id: string): Promise<LegendResponse | null> {
  const legend = legendById(id);
  if (!legend) return null;
  const club = pickClub(legend, await candidatesFor([legend]));
  if (!club) return null;
  const xi = await opponentXI(legend.league, legend.season, club.clubSlug);
  if (!xi || xi.xi.length < 11) return null;
  return { ...xi, legendId: legend.id };
}

/** Legends whose club season has a full squad (11+ players) in the database. */
export async function availableLegends(): Promise<string[]> {
  const candidates = await candidatesFor(LEGENDS);
  const picked = LEGENDS.flatMap((l) => {
    const club = pickClub(l, candidates);
    return club ? [{ id: l.id, league: l.league, season: l.season, clubSlug: club.clubSlug }] : [];
  });
  if (picked.length === 0) return [];
  const counts = await (
    await squadPlayers()
  )
    .aggregate<{ _id: { league: string; season: number; clubSlug: string }; n: number }>([
      { $match: { $or: picked.map(({ league, season, clubSlug }) => ({ league, season, clubSlug })) } },
      { $group: { _id: { league: "$league", season: "$season", clubSlug: "$clubSlug" }, n: { $sum: 1 } } },
    ])
    .toArray();
  const full = new Set(counts.filter((c) => c.n >= 11).map((c) => `${c._id.league}|${c._id.season}|${c._id.clubSlug}`));
  return picked.filter((p) => full.has(`${p.league}|${p.season}|${p.clubSlug}`)).map((p) => p.id);
}
