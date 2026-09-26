import type { League } from './leagues';
import { simulateMatch, type MatchPlayer, type MatchSide } from './match';

/**
 * A whole league season: every club plays every other club twice, once at home and once away,
 * each match simulated with the match engine. Nothing is taken from the real results.
 *
 * Rotation (teams with a `bench`, even an empty one – i.e. your XI): before every match each starter needs a rest with some
 * chance (ROTATION). A substitute of the same role, not already on and better than the tired
 * starter, takes his place; otherwise the starter plays tired (rating × ROTATION.tired). A deep,
 * good bench keeps the XI fresh.
 */

export const ROTATION = {
  /** Chance an outfield starter needs a rest before a match. */
  rest: 0.2,
  /** Goalkeepers rarely rotate. */
  restGK: 0.05,
  /** Rating factor for a starter who needed a rest but had no substitute. */
  tired: 0.9,
};

export type SeasonTeam = MatchSide & { id: string };

export type SeasonRow = {
  id: string;
  name: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

export type SeasonFixture = {
  round: number;
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
};

export type Scorer = { teamId: string; name: string; goals: number };

export type SeasonResult = {
  table: SeasonRow[];
  fixtures: SeasonFixture[];
  scorers: Scorer[];
  pointsForWin: number;
  /** League appearances per player, for rotating teams (with a bench), most first. */
  appearances: { teamId: string; name: string; apps: number; sub: boolean }[];
};

/** The XI a team puts out for one match: starters who need a rest make way for a substitute. */
function matchdaySide(team: SeasonTeam, random: () => number): MatchSide {
  if (!team.bench) return team;
  const used = new Set<number>();
  const xi = team.xi.map((p) => {
    if (random() >= (p.position === 'GK' ? ROTATION.restGK : ROTATION.rest)) return p;
    const tired = { ...p, rating: p.rating === null ? null : p.rating * ROTATION.tired };
    // Like a manager: a substitute only comes in if he is better than the tired starter.
    const k = team.bench!.findIndex(
      (b, i) => !used.has(i) && b.position === p.position && (b.rating ?? 0) >= (tired.rating ?? 0),
    );
    if (k < 0) return tired;
    used.add(k);
    return team.bench![k];
  });
  return { ...team, xi };
}

/** 3 points for a win from 1981/82 in England and 1994/95 (ITA, FRA) / 1995/96 (ESP, GER) elsewhere. */
export function pointsForWin(league: League, season: number): number {
  const from: Record<League, number> = {
    ENG: 1981,
    ITA: 1994,
    FRA: 1994,
    ESP: 1995,
    GER: 1995,
  };
  return season >= from[league] ? 3 : 2;
}

/** Double round robin (circle method): n−1 rounds home, then the same rounds with venues swapped. */
export function roundRobin(ids: readonly string[]): { round: number; home: string; away: string }[] {
  const teams: (string | null)[] = [...ids];
  if (teams.length % 2) teams.push(null);
  const n = teams.length;
  const first: { round: number; home: string; away: string }[] = [];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = teams[i];
      const b = teams[n - 1 - i];
      if (!a || !b) continue;
      // Alternate venues so nobody plays all first-half games at home.
      const swap = (r + i) % 2 === 1;
      first.push({ round: r + 1, home: swap ? b : a, away: swap ? a : b });
    }
    teams.splice(1, 0, teams.pop()!);
  }
  return [
    ...first,
    ...first.map((f) => ({
      round: f.round + n - 1,
      home: f.away,
      away: f.home,
    })),
  ];
}

export function simulateSeason(
  teams: readonly SeasonTeam[],
  pointsWin = 3,
  random: () => number = Math.random,
): SeasonResult {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const rows = new Map<string, SeasonRow>(
    teams.map((t) => [
      t.id,
      {
        id: t.id,
        name: t.name,
        position: 0,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      },
    ]),
  );
  const scorers = new Map<string, Scorer>();
  const fixtures: SeasonFixture[] = [];
  const apps = new Map<string, { teamId: string; name: string; apps: number; sub: boolean }>();
  const countApps = (team: SeasonTeam, side: MatchSide) => {
    if (!team.bench) return;
    const subs = new Set(team.bench.map((b) => b.name));
    for (const p of side.xi) {
      const key = `${team.id}|${p.name}`;
      const a = apps.get(key) ?? { teamId: team.id, name: p.name, apps: 0, sub: subs.has(p.name) };
      a.apps++;
      apps.set(key, a);
    }
  };

  for (const f of roundRobin(teams.map((t) => t.id))) {
    const home = matchdaySide(byId.get(f.home)!, random);
    const away = matchdaySide(byId.get(f.away)!, random);
    countApps(byId.get(f.home)!, home);
    countApps(byId.get(f.away)!, away);
    const result = simulateMatch(home, away, random);
    fixtures.push({
      ...f,
      homeGoals: result.homeGoals,
      awayGoals: result.awayGoals,
    });
    const h = rows.get(f.home)!;
    const a = rows.get(f.away)!;
    h.played++;
    a.played++;
    h.goalsFor += result.homeGoals;
    h.goalsAgainst += result.awayGoals;
    a.goalsFor += result.awayGoals;
    a.goalsAgainst += result.homeGoals;
    if (result.homeGoals > result.awayGoals) {
      h.won++;
      a.lost++;
      h.points += pointsWin;
    } else if (result.homeGoals < result.awayGoals) {
      a.won++;
      h.lost++;
      a.points += pointsWin;
    } else {
      h.drawn++;
      a.drawn++;
      h.points++;
      a.points++;
    }
    for (const g of result.goals) {
      const teamId = g.side === 'home' ? f.home : f.away;
      const key = `${teamId}|${g.scorer}`;
      const s = scorers.get(key) ?? { teamId, name: g.scorer, goals: 0 };
      s.goals++;
      scorers.set(key, s);
    }
  }

  const table = [...rows.values()].sort(
    (x, y) =>
      y.points - x.points ||
      y.goalsFor - y.goalsAgainst - (x.goalsFor - x.goalsAgainst) ||
      y.goalsFor - x.goalsFor ||
      x.name.localeCompare(y.name),
  );
  table.forEach((r, i) => (r.position = i + 1));
  return {
    table,
    fixtures,
    scorers: [...scorers.values()].sort((x, y) => y.goals - x.goals || x.name.localeCompare(y.name)),
    pointsForWin: pointsWin,
    appearances: [...apps.values()].sort((x, y) => y.apps - x.apps || x.name.localeCompare(y.name)),
  };
}

/** GET /api/season-xis?league=ENG&season=1975 – every club's likely XI that season. */
export type SeasonXIsResponse = {
  league: League;
  season: number;
  clubs: {
    clubSlug: string;
    club: string;
    xi: (MatchPlayer & { positions: string[] })[];
  }[];
};
