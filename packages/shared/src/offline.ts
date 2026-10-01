import type { ClubsResponse, LeagueTableLine } from './clubs';
import { seasonLabel } from './clubs';
import { simulateCup, type CupFieldResponse, type CupTeam } from './cup';
import { DECADES, LEAGUES, type League } from './leagues';
import { LEGENDS, legendById, type Legend, type LegendResponse } from './legends';
import { squadInsight, type MatchPlayer, type MatchSide, type OpponentResponse } from './match';
import {
  YOUR_ID,
  cupReport,
  leagueReport,
  legendReport,
  matchReport,
  playLegendTie,
  playMatch,
  type PlayChoice,
  type PlayResponse,
} from './play';
import { pointsForWin, simulateSeason, type SeasonTeam, type SeasonXIsResponse } from './season';
import type { SquadResponse } from './squads';
import { weakestClub, type LeagueTableRow } from './tournaments';

/**
 * One implementation of "play a tournament", used by the server (data from the database, the
 * result stored and ranked) and by the app when it is offline (data from the downloaded pack, the
 * result unranked). `TournamentData` is where the real clubs come from.
 */

export type TournamentData = {
  opponentXI(league: League, season: number, clubSlug: string): Promise<OpponentResponse | null>;
  leagueTable(league: League, season: number): Promise<LeagueTableRow[]>;
  seasonXIs(league: League, season: number): Promise<SeasonXIsResponse | null>;
  cupField(season: number): Promise<CupFieldResponse | null>;
  legendXI(id: string): Promise<LegendResponse | null>;
};

/** A choice that can't be played (unknown club, no data for the season…): shown to the player. */
export class PlayError extends Error {
  name = 'PlayError';
}

/** The modes that need nothing but your side and real clubs (no other player, no Daily rules). */
export type SoloChoice = Extract<PlayChoice, { mode: 'match' | 'legend' | 'league' | 'cup' }>;

const isLeague = (x: unknown): x is League => (LEAGUES as readonly unknown[]).includes(x);
const avg = (xs: (number | null)[]) => {
  const k = xs.filter((x): x is number => x !== null);
  return k.length ? k.reduce((a, b) => a + b, 0) / k.length : null;
};

export async function simulateTournament(
  choice: SoloChoice,
  you: MatchSide,
  data: TournamentData,
  random: () => number = Math.random,
): Promise<PlayResponse> {
  switch (choice.mode) {
    case 'match': {
      if (!isLeague(choice.league)) throw new PlayError('league');
      const opp = await data.opponentXI(choice.league, Number(choice.season), String(choice.clubSlug));
      if (!opp || opp.xi.length === 0) throw new PlayError('No squad for that club season');
      const played = playMatch(you, { name: opp.club, xi: opp.xi, factor: 1 }, 'random', random);
      return { mode: 'match', played, report: matchReport(played, `vs ${opp.club} ${seasonLabel(opp.season)}`) };
    }
    case 'legend': {
      const legend = legendById(String(choice.legendId));
      const xi = legend ? await data.legendXI(legend.id) : null;
      if (!legend || !xi || xi.xi.length === 0) throw new PlayError("That legend can't be played yet");
      const them = { name: legend.nickname, xi: xi.xi, factor: 1 };
      const title = `vs ${legend.nickname} (${legend.club} ${seasonLabel(legend.season)})`;
      if (choice.format === 'single') {
        const played = playMatch(you, them, 'random', random);
        return { mode: 'legend', tie: null, played, report: { ...matchReport(played, title), mode: 'legend' } };
      }
      const tie = playLegendTie(you, them, random);
      return { mode: 'legend', tie, played: null, report: legendReport(tie, title) };
    }
    case 'league': {
      if (!isLeague(choice.league)) throw new PlayError('league');
      const season = Number(choice.season);
      const rows = await data.leagueTable(choice.league, season);
      const replaced = weakestClub(rows);
      const xis = await data.seasonXIs(choice.league, season);
      if (!replaced || !xis) throw new PlayError('No data for that season');
      const teams: SeasonTeam[] = xis.clubs
        .filter((c) => c.clubSlug !== replaced.clubSlug && c.xi.length > 0)
        .map((c) => ({ id: c.clubSlug, name: c.club, xi: c.xi, factor: 1 }));
      const all = [...teams, { ...you, id: YOUR_ID }];
      const result = simulateSeason(all, pointsForWin(choice.league, season), random, { detailFor: YOUR_ID });
      return {
        mode: 'league',
        result,
        teams: all.map((t) => ({ id: t.id, name: t.name, rating: avg(t.xi.map((p) => p.rating)) })),
        replaced: replaced.club,
        insight: squadInsight(you, teams),
        bench: you.bench?.length ?? 0,
        report: leagueReport(result, choice.league, season),
      };
    }
    case 'cup': {
      const season = Number(choice.season);
      const field = await data.cupField(season);
      if (!field) throw new PlayError('No field for that season');
      const teams: CupTeam[] = [
        { ...you, id: YOUR_ID, league: null },
        ...field.clubs
          .filter((c) => c.xi.length > 0)
          .map((c) => ({ id: `${c.league}|${c.clubSlug}`, name: c.club, xi: c.xi, factor: 1, league: c.league, elo: c.elo })),
      ].slice(0, 32);
      const result = simulateCup(teams, random);
      const facedIds = new Set(
        result.matches.flatMap((m) => (m.home === YOUR_ID ? [m.away] : m.away === YOUR_ID ? [m.home] : [])),
      );
      return {
        mode: 'cup',
        result,
        teams: teams.map((t) => ({ id: t.id, name: t.name, league: t.league, elo: t.elo ?? null })),
        insight: squadInsight(you, teams.filter((t) => facedIds.has(t.id))),
        report: cupReport(result, season),
      };
    }
  }
}

// ---- Legends: which club season stands for a legend.

/** The club season a legend stands for: slug pattern in that league season, strongest (Elo) first. */
export function legendClub<C extends { league: string; season: number; clubSlug: string; elo?: number | null }>(
  legend: Legend,
  candidates: readonly C[],
): C | null {
  const slug = new RegExp(legend.slug);
  const not = legend.notSlug ? new RegExp(legend.notSlug) : null;
  return (
    candidates
      .filter((c) => c.league === legend.league && c.season === legend.season)
      .filter((c) => slug.test(c.clubSlug) && !not?.test(c.clubSlug))
      .sort((a, b) => (b.elo ?? 0) - (a.elo ?? 0))[0] ?? null
  );
}

// ---- The offline pack: what the app downloads to draft and play without a connection.

type XI = (MatchPlayer & { positions: string[] })[];

/** GET /api/offline/draft?league=ENG&decade=1990 – every club of the cell with its decade squad. */
export type OfflineDraftCell = {
  league: League;
  decade: number;
  clubs: ClubsResponse['clubs'];
  /** By club slug: exactly what GET /api/squad returns for that club. */
  squads: Record<string, SquadResponse['players']>;
};

/** One real club season: its likely XI, final table line and Elo. */
export type OfflineClubSeason = { clubSlug: string; club: string; elo: number | null; table: LeagueTableLine | null; xi: XI };

/** GET /api/offline/seasons?league=ENG – every club season of a league. */
export type OfflineLeagueSeasons = { league: League; seasons: Record<string, OfflineClubSeason[]> };

/** GET /api/offline/manifest – what a complete pack consists of, and its version. */
export type OfflineManifest = {
  /** Changes when the data changed (a newer pack can be downloaded). */
  version: string;
  cells: { league: League; decade: number }[];
  leagues: League[];
};

export const OFFLINE_CELLS: OfflineManifest['cells'] = LEAGUES.flatMap((league) =>
  DECADES.map((decade) => ({ league, decade: Number(decade) })),
);

/** Clubs in the Champions League field (with your XI: 32). */
export const CUP_CLUBS = 31;

/**
 * Tournament data from the pack. `load` returns a league's seasons (null when that file is not on
 * the device). Mirrors what the server reads from the database.
 */
export function packTournamentData(load: (league: League) => Promise<OfflineLeagueSeasons | null>): TournamentData {
  const clubsOf = async (league: League, season: number) => (await load(league))?.seasons[String(season)] ?? [];
  const opponentXI: TournamentData['opponentXI'] = async (league, season, clubSlug) => {
    const club = (await clubsOf(league, season)).find((c) => c.clubSlug === clubSlug);
    return club ? { league, season, clubSlug, club: club.club, xi: club.xi } : null;
  };
  return {
    opponentXI,
    async leagueTable(league, season) {
      return (await clubsOf(league, season))
        .flatMap((c) => (c.table ? [{ ...c.table, club: c.club, clubSlug: c.clubSlug, elo: c.elo }] : []))
        .sort((a, b) => a.position - b.position);
    },
    async seasonXIs(league, season) {
      const clubs = (await clubsOf(league, season)).filter((c) => c.table);
      if (clubs.length === 0) return null;
      return {
        league,
        season,
        clubs: clubs
          .sort((a, b) => (a.table?.position ?? 99) - (b.table?.position ?? 99))
          .map((c) => ({ clubSlug: c.clubSlug, club: c.club, xi: c.xi })),
      };
    },
    async cupField(season) {
      const all = (
        await Promise.all(LEAGUES.map(async (league) => (await clubsOf(league, season)).map((c) => ({ ...c, league }))))
      )
        .flat()
        .filter((c) => c.table);
      if (all.length < CUP_CLUBS) return null;
      return {
        season,
        clubs: all
          .sort((a, b) => (b.elo ?? 0) - (a.elo ?? 0) || (a.table?.position ?? 99) - (b.table?.position ?? 99))
          .slice(0, CUP_CLUBS)
          .map((c) => ({ league: c.league, clubSlug: c.clubSlug, club: c.club, elo: c.elo, xi: c.xi })),
      };
    },
    async legendXI(id) {
      const legend = legendById(id);
      if (!legend) return null;
      const candidates = (await clubsOf(legend.league, legend.season)).map((c) => ({
        ...c,
        league: legend.league,
        season: legend.season,
      }));
      const club = legendClub(legend, candidates);
      if (!club || club.xi.length < 11) return null;
      return { league: legend.league, season: legend.season, clubSlug: club.clubSlug, club: club.club, xi: club.xi, legendId: id };
    },
  };
}

/** Legends that can be played from the pack (their club season has a full XI). */
export async function packLegends(data: TournamentData): Promise<string[]> {
  const found = await Promise.all(LEGENDS.map(async (l) => ((await data.legendXI(l.id)) ? l.id : null)));
  return found.filter((id): id is string => id !== null);
}
