import type { Game } from "./resolve";
import { isRatedLeague } from "./types";

/**
 * Club Elo from match results, in the spirit of clubelo.com:
 * - expected result E = 1 / (1 + 10^((Rb − Ra − HFA) / 400)); after the match both ratings move
 *   by K · G · (result − E), so every match is zero-sum.
 * - G grows with the goal margin (1 / 1.5 / (11 + margin) / 8), as in the World Football Elo.
 * - European matches count double (K 40): they are the only link between the leagues' pools.
 *   Clubs from other countries are rated through their European matches only (start 1400).
 * - Home advantage (HFA) is learned per league from its own results (it was ~100 Elo in the
 *   1960s and is far smaller today). Cup finals are neutral.
 * - Promoted clubs start at the mean final rating of the clubs they replace. This keeps each
 *   league's rating pool closed, so a league only gains strength by winning European matches.
 *   That is what makes a 1975 Bundesliga rating comparable to a 1975 Serie A one.
 * - A league season with no match results but a final table (FRA 1994/95) is rated as one
 *   block: each club's points against what its rating predicted for a full double round-robin.
 */
export const ELO = {
  start: 1500,
  k: 20,
  /** K multiplier for European matches (they are the only link between leagues). */
  europeFactor: 2,
  /** First rating of a club from another country (no league results): a typical European minnow. */
  foreignStart: 1400,
  initialHfa: 80,
  /** How fast a league's home advantage follows its results (Elo points per match). */
  hfaStep: 1,
};

export type TeamSeason = {
  league: string;
  season: number;
  key: string;
  /** Mean pre-match rating over the club's league matches that season. */
  mean: number;
  /** Rating after its last league match that season. */
  end: number;
  games: number;
  /** Rated from the final table only (no match results for that season). */
  fromTable?: boolean;
};

/** A league season known only by its final table. Rows: team key and W/D/L. */
export type TableSeason = {
  league: string;
  season: number;
  /** When to apply it: the end of the season. */
  date: string;
  rows: { key: string; won: number; drawn: number; lost: number }[];
};

export type EloResult = {
  teamSeasons: Map<string, TeamSeason>; // "ENG 1975 tm:31"
  /** Rating of every key right now (after the last match). */
  current: Map<string, number>;
  hfa: Map<string, number>;
  leagueMeans: Map<string, number>; // "ENG 1975" → mean of its clubs' season means
};

const margin = (goalDiff: number) => {
  const d = Math.abs(goalDiff);
  return d <= 1 ? 1 : d === 2 ? 1.5 : (11 + d) / 8;
};

export const expected = (home: number, away: number, hfa: number) => 1 / (1 + 10 ** ((away - home - hfa) / 400));

type Event = { date: string; game?: Game; table?: TableSeason };

export function runElo(games: Game[], tables: TableSeason[] = []): EloResult {
  const events: Event[] = [...games.map((game) => ({ date: game.date, game })), ...tables.map((table) => ({ date: table.date, table }))];
  const sorted = events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // Teams per league season.
  const teamsOf = new Map<string, Set<string>>();
  const addTeams = (k: string, keys: string[]) => {
    if (!teamsOf.has(k)) teamsOf.set(k, new Set());
    for (const key of keys) teamsOf.get(k)!.add(key);
  };
  for (const g of games) if (g.comp !== "EUR") addTeams(`${g.comp} ${g.season}`, [g.home, g.away]);
  for (const t of tables) addTeams(`${t.league} ${t.season}`, t.rows.map((r) => r.key));

  const rating = new Map<string, number>();
  const hfa = new Map<string, number>();
  const activeSeason = new Map<string, number>(); // league → season being played
  const teamSeasons = new Map<string, TeamSeason & { sum: number }>();

  const startSeason = (league: string, season: number) => {
    const teams = teamsOf.get(`${league} ${season}`)!;
    const prevSeason = activeSeason.get(league);
    activeSeason.set(league, season);
    const prevTeams = prevSeason === undefined ? null : teamsOf.get(`${league} ${prevSeason}`)!;

    let entryLevel: number;
    if (prevTeams) {
      const left = [...prevTeams].filter((t) => !teams.has(t));
      const pool = left.length ? left : [...prevTeams];
      entryLevel = pool.reduce((s, t) => s + (rating.get(t) ?? ELO.start), 0) / pool.length - (left.length ? 0 : 50);
    } else {
      // A league's first season on record: start from the other leagues' average.
      const others = [...activeSeason.entries()].filter(([l]) => l !== league).flatMap(([l, s]) => [...teamsOf.get(`${l} ${s}`)!]);
      entryLevel = others.length ? others.reduce((s, t) => s + (rating.get(t) ?? ELO.start), 0) / others.length : ELO.start;
      hfa.set(league, ELO.initialHfa);
    }
    for (const t of teams) if (!prevTeams?.has(t)) rating.set(t, entryLevel);
  };

  const rateTable = (t: TableSeason) => {
    if (activeSeason.get(t.league) !== t.season) startSeason(t.league, t.season);
    const h = hfa.get(t.league)!;
    const pre = new Map(t.rows.map((r) => [r.key, rating.get(r.key)!]));
    const full = 2 * (t.rows.length - 1);
    const deltas = t.rows.map((r) => {
      let e = 0;
      for (const o of t.rows) {
        if (o.key === r.key) continue;
        e += expected(pre.get(r.key)!, pre.get(o.key)!, h) + (1 - expected(pre.get(o.key)!, pre.get(r.key)!, h));
      }
      const played = r.won + r.drawn + r.lost;
      return ELO.k * (r.won + r.drawn / 2 - (e * played) / full);
    });
    // Rounding in the table can leave a small imbalance: keep the league's pool closed.
    const drift = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    t.rows.forEach((r, i) => {
      const before = pre.get(r.key)!;
      const after = before + deltas[i] - drift;
      rating.set(r.key, after);
      // Ratings move gradually over a season: its mean is halfway.
      teamSeasons.set(`${t.league} ${t.season} ${r.key}`, {
        league: t.league,
        season: t.season,
        key: r.key,
        mean: 0,
        end: after,
        games: r.won + r.drawn + r.lost,
        sum: ((before + after) / 2) * (r.won + r.drawn + r.lost),
        fromTable: true,
      });
    });
  };

  for (const ev of sorted) {
    if (ev.table) {
      rateTable(ev.table);
      continue;
    }
    const g = ev.game!;
    if (g.comp !== "EUR" && activeSeason.get(g.comp) !== g.season) startSeason(g.comp, g.season);
    if (g.comp === "EUR") {
      for (const [key, country] of [
        [g.home, g.homeCountry],
        [g.away, g.awayCountry],
      ]) {
        if (!rating.has(key) && key.startsWith(`${country}:`) && !isRatedLeague(country)) rating.set(key, ELO.foreignStart);
      }
    }
    const rh = rating.get(g.home);
    const ra = rating.get(g.away);
    // European match of a club that has no league rating yet: skip.
    if (rh === undefined || ra === undefined) continue;

    const leagueHfa = g.comp === "EUR" ? (hfa.get(g.homeCountry) ?? ELO.initialHfa) : hfa.get(g.comp)!;
    const h = g.neutral ? 0 : leagueHfa;
    const e = expected(rh, ra, h);
    const result = g.homeGoals > g.awayGoals ? 1 : g.homeGoals < g.awayGoals ? 0 : 0.5;
    const delta = ELO.k * (g.comp === "EUR" ? ELO.europeFactor : 1) * margin(g.homeGoals - g.awayGoals) * (result - e);

    if (g.comp !== "EUR") {
      for (const [key, pre] of [
        [g.home, rh],
        [g.away, ra],
      ] as const) {
        const tk = `${g.comp} ${g.season} ${key}`;
        const ts = teamSeasons.get(tk) ?? { league: g.comp, season: g.season, key, mean: 0, end: 0, games: 0, sum: 0 };
        ts.sum += pre;
        ts.games++;
        teamSeasons.set(tk, ts);
      }
      if (!g.neutral) hfa.set(g.comp, leagueHfa + ELO.hfaStep * (result - e));
    }

    rating.set(g.home, rh + delta);
    rating.set(g.away, ra - delta);
    if (g.comp !== "EUR") {
      teamSeasons.get(`${g.comp} ${g.season} ${g.home}`)!.end = rh + delta;
      teamSeasons.get(`${g.comp} ${g.season} ${g.away}`)!.end = ra - delta;
    }
  }

  const out = new Map<string, TeamSeason>();
  const sums = new Map<string, { s: number; n: number }>();
  for (const [k, { sum, ...ts }] of teamSeasons) {
    ts.mean = ts.games ? sum / ts.games : ts.end;
    out.set(k, ts);
    const lk = `${ts.league} ${ts.season}`;
    const agg = sums.get(lk) ?? { s: 0, n: 0 };
    agg.s += ts.mean;
    agg.n++;
    sums.set(lk, agg);
  }
  const leagueMeans = new Map([...sums].map(([k, { s, n }]) => [k, s / n]));
  return { teamSeasons: out, current: rating, hfa, leagueMeans };
}
