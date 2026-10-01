import "server-only";

import {
  LEAGUES,
  OFFLINE_CELLS,
  pickStartingXI,
  type League,
  type OfflineClubSeason,
  type OfflineDraftCell,
  type OfflineLeagueSeasons,
  type OfflineManifest,
} from "@champion/shared";

import { clubsInDecade } from "./club-data";
import { clubSeasons, squadPlayers } from "./db";
import { squadInDecade } from "./squad-data";

// The offline pack: the same data the draft and the tournaments read one request at a time,
// in a few big files the app keeps on the device. Public, read-only game data.

/** Squads are built a few at a time (each one is a couple of queries). */
const PARALLEL = 6;

/** Every club of a league decade with its decade squad – what /api/clubs and /api/squad return. */
export async function offlineDraftCell(league: League, decade: number): Promise<OfflineDraftCell> {
  const clubs = await clubsInDecade(league, decade);
  const squads: OfflineDraftCell["squads"] = {};
  for (let i = 0; i < clubs.length; i += PARALLEL) {
    const batch = clubs.slice(i, i + PARALLEL);
    const players = await Promise.all(batch.map((c) => squadInDecade(league, decade, c.clubSlug)));
    batch.forEach((c, k) => (squads[c.clubSlug] = players[k]!));
  }
  return { league, decade, clubs, squads };
}

/** Every club season of a league: likely XI, table line, Elo (opponents for every mode). */
export async function offlineLeagueSeasons(league: League): Promise<OfflineLeagueSeasons> {
  const [clubs, squad] = await Promise.all([
    (await clubSeasons())
      .find({ league }, { projection: { _id: 0, season: 1, club: 1, clubSlug: 1, table: 1, elo: 1 } })
      .toArray(),
    (await squadPlayers())
      .find(
        { league },
        {
          projection: {
            _id: 0,
            season: 1,
            clubSlug: 1,
            name: 1,
            position: 1,
            positions: 1,
            rating: 1,
            goals: 1,
            appearances: 1,
            minutes: 1,
          },
        },
      )
      .toArray(),
  ]);
  const byClub = new Map<string, typeof squad>();
  for (const p of squad) {
    const key = `${p.season}|${p.clubSlug}`;
    const list = byClub.get(key);
    if (list) list.push(p);
    else byClub.set(key, [p]);
  }
  const seasons: OfflineLeagueSeasons["seasons"] = {};
  for (const c of clubs) {
    const row: OfflineClubSeason = {
      clubSlug: c.clubSlug,
      club: c.club,
      elo: c.elo ?? null,
      table: c.table ?? null,
      xi: pickStartingXI(
        (byClub.get(`${c.season}|${c.clubSlug}`) ?? []).map((p) => ({
          name: p.name,
          position: p.position,
          positions: p.positions ?? [],
          rating: p.rating ?? null,
          goals: p.goals,
          appearances: p.appearances,
          minutes: p.minutes ?? null,
        })),
      ),
    };
    (seasons[String(c.season)] ??= []).push(row);
  }
  return { league, seasons };
}

/** The pack's version: changes when club seasons or squads were imported or re-rated. */
export async function offlineManifest(): Promise<OfflineManifest> {
  const [latest, players] = await Promise.all([
    (await clubSeasons()).find({}, { projection: { _id: 0, updatedAt: 1 } }).sort({ updatedAt: -1 }).limit(1).toArray(),
    (await squadPlayers()).estimatedDocumentCount(),
  ]);
  const stamp = latest[0]?.updatedAt ? new Date(latest[0].updatedAt).toISOString().slice(0, 10) : "0";
  return { version: `${stamp}-${players}`, cells: OFFLINE_CELLS, leagues: [...LEAGUES] };
}
