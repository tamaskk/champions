import "server-only";

import {
  pickStartingXI,
  type CupFieldResponse,
  type League,
  type OpponentResponse,
  type SeasonXIsResponse,
} from "@champion/shared";

import { clubSeasons, squadPlayers } from "./db";

/** A real club season's likely XI (most used players by position) with season ratings. */
export async function opponentXI(league: League, season: number, clubSlug: string): Promise<OpponentResponse | null> {
  const club = await (await clubSeasons()).findOne({ league, season, clubSlug }, { projection: { club: 1 } });
  if (!club) return null;
  const squad = await (await squadPlayers())
    .find(
      { league, season, clubSlug },
      { projection: { _id: 0, name: 1, position: 1, positions: 1, rating: 1, goals: 1, appearances: 1, minutes: 1 } },
    )
    .toArray();
  const xi = pickStartingXI(
    squad.map((p) => ({
      name: p.name,
      position: p.position,
      positions: p.positions ?? [],
      rating: p.rating ?? null,
      goals: p.goals,
      appearances: p.appearances,
      minutes: p.minutes ?? null,
    })),
  );
  return { league, season, clubSlug, club: club.club, xi };
}

/**
 * Every club of a league season with its likely XI – the clubs of that season's table (so the
 * simulated league has the real field). One squad query for the whole league.
 */
export async function seasonXIs(league: League, season: number): Promise<SeasonXIsResponse | null> {
  const clubs = await (await clubSeasons())
    .find({ league, season, table: { $type: "object" } }, { projection: { _id: 0, club: 1, clubSlug: 1, table: 1 } })
    .toArray();
  if (clubs.length === 0) return null;
  const squad = await (await squadPlayers())
    .find(
      { league, season },
      {
        projection: {
          _id: 0,
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
    .toArray();
  const byClub = new Map<string, typeof squad>();
  for (const p of squad) byClub.set(p.clubSlug, [...(byClub.get(p.clubSlug) ?? []), p]);
  return {
    league,
    season,
    clubs: clubs
      .sort((a, b) => (a.table?.position ?? 99) - (b.table?.position ?? 99))
      .map((c) => ({
        clubSlug: c.clubSlug,
        club: c.club,
        xi: pickStartingXI(
          (byClub.get(c.clubSlug) ?? []).map((p) => ({
            name: p.name,
            position: p.position,
            positions: p.positions ?? [],
            rating: p.rating ?? null,
            goals: p.goals,
            appearances: p.appearances,
            minutes: p.minutes ?? null,
          })),
        ),
      })),
  };
}

/** Clubs in the Champions League field (with your XI: 32). */
const CUP_CLUBS = 31;

/**
 * Champions League field of a season: the strongest clubs of the top five leagues by our Elo
 * (table position where a season has no Elo), each with its likely XI.
 */
export async function cupField(season: number): Promise<CupFieldResponse | null> {
  const clubs = await (await clubSeasons())
    .find({ season, table: { $type: "object" } }, { projection: { _id: 0, league: 1, club: 1, clubSlug: 1, elo: 1, table: 1 } })
    .toArray();
  if (clubs.length < CUP_CLUBS) return null;
  const field = clubs
    .sort((a, b) => (b.elo ?? 0) - (a.elo ?? 0) || (a.table?.position ?? 99) - (b.table?.position ?? 99))
    .slice(0, CUP_CLUBS);
  const squad = await (await squadPlayers())
    .find(
      { season, $or: field.map((c) => ({ league: c.league, clubSlug: c.clubSlug })) },
      {
        projection: {
          _id: 0,
          league: 1,
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
    .toArray();
  const byClub = new Map<string, typeof squad>();
  for (const p of squad) {
    const key = `${p.league}|${p.clubSlug}`;
    byClub.set(key, [...(byClub.get(key) ?? []), p]);
  }
  return {
    season,
    clubs: field.map((c) => ({
      league: c.league,
      clubSlug: c.clubSlug,
      club: c.club,
      elo: c.elo ?? null,
      xi: pickStartingXI(
        (byClub.get(`${c.league}|${c.clubSlug}`) ?? []).map((p) => ({
          name: p.name,
          position: p.position,
          positions: p.positions ?? [],
          rating: p.rating ?? null,
          goals: p.goals,
          appearances: p.appearances,
          minutes: p.minutes ?? null,
        })),
      ),
    })),
  };
}
