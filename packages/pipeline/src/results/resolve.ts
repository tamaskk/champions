import type { League } from "@champion/shared";

import { clubSimilarity, matchClubs } from "../match-clubs";
import type { TmClubMap } from "../transfermarkt/club-map";
import { isRatedLeague, type RatedLeague, type RawMatch } from "./types";

/** A match with both teams resolved to a stable team key ("tm:27", or "GER:<name>" when unlinked). */
export type Game = {
  date: string;
  season: number;
  comp: RatedLeague | "EUR";
  home: string;
  away: string;
  homeCountry: string;
  awayCountry: string;
  homeGoals: number;
  awayGoals: number;
  neutral: boolean;
};

/** How a source name was linked to a Transfermarkt club in one league season. */
export type NameLink = { key: string; tmId: number | null; score: number; how: string };

/** Manual fixes: { "<LEAGUE>": { "<source team name>": <Transfermarkt id> } }. */
export type ResultAliases = Partial<Record<League, Record<string, number>>>;

const CONFIDENT = 0.85;
/** A European-cup team counts as one of our clubs from this similarity on. */
const CUP_MIN_SCORE = 0.6;
/** Clubs without a Transfermarkt map: names from different sources are joined from this score on. */
const CANON_MIN_SCORE = 0.75;

const lsKey = (league: string, season: number) => `${league} ${season}`;
const slugName = (slug: string) => slug.replace(/-/g, " ");

export type Resolution = {
  games: Game[];
  /** "ENG 1975" → source name → link. */
  links: Map<string, Map<string, NameLink>>;
  /** League teams that could not be linked to a Transfermarkt club (rated anyway, under their name). */
  unlinked: { league: string; season: number; name: string }[];
  /** Links below the confident score: worth a look. */
  weak: { league: string; season: number; name: string; tmName: string; score: number }[];
  /** European-cup teams from our countries that matched no club of that league: match skipped. */
  cupUnresolved: { season: number; country: string; name: string }[];
  /** European-cup matches against a club from another country (rated without a league). */
  cupForeign: number;
  /** European-cup matches skipped because a team of ours could not be resolved. */
  cupSkipped: number;
};

/**
 * Gives every team a stable key. League teams are matched, per league season, to the
 * Transfermarkt clubs `tm:clubs` linked for that season (~20 candidates, so name matching is
 * reliable), so one club keeps one key across sources and renames. A name that is linked in some
 * seasons keeps that key in seasons without a map (e.g. before 1960). European-cup teams are
 * matched to the teams of their country's league that season or the one before; clubs from
 * other countries are rated too, but only through their European matches.
 */
export function resolveTeams(raw: RawMatch[], clubMap: TmClubMap, aliases: ResultAliases): Resolution {
  const leagueNames = new Map<string, Set<string>>(); // "ENG 1975" → names
  for (const m of raw) {
    if (m.comp === "EUR") continue;
    const k = lsKey(m.comp, m.season);
    if (!leagueNames.has(k)) leagueNames.set(k, new Set());
    leagueNames.get(k)!.add(m.home).add(m.away);
  }

  const links = new Map<string, Map<string, NameLink>>();
  const weak: Resolution["weak"] = [];
  const tmNameOf = new Map<number, string>();

  // Pass 1 collects confident name → id links, pass 2 reuses them as "known" in other seasons.
  const confident = new Map<string, Map<number, number>>(); // "ENG|Arsenal" → id → seasons
  const linkSeason = (league: League, season: number, names: string[], usePass1: boolean) => {
    const cands = Object.entries(clubMap[league]?.[String(season)] ?? {}).map(([slug, ref]) => ({ slug, ...ref }));
    for (const c of cands) tmNameOf.set(c.tmId, c.tmName);
    const known = (name: string) => {
      const alias = aliases[league]?.[name];
      if (alias !== undefined) return { id: alias, how: "alias" as const };
      if (!usePass1) return undefined;
      let best: number | undefined;
      let n = 0;
      for (const [id, count] of confident.get(`${league}|${name}`) ?? []) if (count > n) [best, n] = [id, count];
      return best === undefined ? undefined : { id: best, how: "known" as const };
    };
    return matchClubs(names, cands, {
      oursName: (n) => n,
      theirsName: (c) => [c.tmName, slugName(c.slug)],
      theirsId: (c) => c.tmId,
      known,
    }).matches;
  };

  const gameLeagues = [...leagueNames.keys()].map((k) => {
    const [league, season] = k.split(" ");
    return { league, season: Number(season), names: [...leagueNames.get(k)!] };
  });

  for (const { league, season, names } of gameLeagues) {
    if (league === "NED") continue;
    for (const m of linkSeason(league as League, season, names, false)) {
      if (m.how === "alias" || (m.how === "name" && m.score >= CONFIDENT)) {
        const k = `${league}|${m.ours}`;
        if (!confident.has(k)) confident.set(k, new Map());
        const ids = confident.get(k)!;
        ids.set(m.theirs.tmId, (ids.get(m.theirs.tmId) ?? 0) + 1);
      }
    }
  }

  // Most frequent confident id per name: the key for seasons without a Transfermarkt map.
  const globalId = new Map<string, number>();
  for (const [k, ids] of confident) {
    let best = 0;
    let n = 0;
    for (const [id, count] of ids) if (count > n) [best, n] = [id, count];
    globalId.set(k, best);
  }

  // Clubs without a Transfermarkt map (NED, other countries' cup teams): names from different
  // sources ("Sporting CP" / "Sporting Clube de Portugal") are joined per country by similarity.
  const canonNames = new Map<string, string[]>();
  const canonical = (country: string, name: string) => {
    const list = canonNames.get(country) ?? [];
    canonNames.set(country, list);
    if (list.includes(name)) return name;
    const best = list.map((n) => ({ n, s: clubSimilarity(name, n) })).sort((a, b) => b.s - a.s)[0];
    if (best && best.s >= CANON_MIN_SCORE) return best.n;
    list.push(name);
    return name;
  };

  const unlinked: Resolution["unlinked"] = [];
  for (const { league, season, names } of gameLeagues.sort((a, b) => a.season - b.season)) {
    const map = new Map<string, NameLink>();
    if (league === "NED") {
      for (const name of names) map.set(name, { key: `NED:${canonical("NED", name)}`, tmId: null, score: 1, how: "name" });
    } else {
      const matched = linkSeason(league as League, season, names, true);
      for (const m of matched) {
        map.set(m.ours, { key: `tm:${m.theirs.tmId}`, tmId: m.theirs.tmId, score: m.score, how: m.how });
        if (m.how === "name" || m.how === "last-left") {
          if (m.score < CONFIDENT) weak.push({ league, season, name: m.ours, tmName: m.theirs.tmName, score: Math.round(m.score * 100) / 100 });
        }
      }
      const hasMap = Boolean(clubMap[league as League]?.[String(season)]);
      for (const name of names) {
        if (map.has(name)) continue;
        const id = globalId.get(`${league}|${name}`);
        if (id !== undefined) map.set(name, { key: `tm:${id}`, tmId: id, score: 1, how: "other-season" });
        else {
          map.set(name, { key: `${league}:${name}`, tmId: null, score: 0, how: "unlinked" });
          if (hasMap) unlinked.push({ league, season, name });
        }
      }
    }
    links.set(lsKey(league, season), map);
  }

  // All names each key goes by (source names + Transfermarkt name), for European-cup matching.
  const namesOfKey = new Map<string, Set<string>>();
  for (const map of links.values()) {
    for (const [name, link] of map) {
      if (!namesOfKey.has(link.key)) namesOfKey.set(link.key, new Set());
      namesOfKey.get(link.key)!.add(name);
      if (link.tmId !== null && tmNameOf.has(link.tmId)) namesOfKey.get(link.key)!.add(tmNameOf.get(link.tmId)!);
    }
  }

  const cupCache = new Map<string, string | null>();
  const cupUnresolved: Resolution["cupUnresolved"] = [];
  const cupKey = (name: string, country: string, season: number): string | null => {
    const ck = `${country}|${season}|${name}`;
    if (cupCache.has(ck)) return cupCache.get(ck)!;
    const keys = new Set<string>();
    for (const s of [season - 1, season]) for (const l of links.get(lsKey(country, s))?.values() ?? []) keys.add(l.key);
    let best: string | null = null;
    let bestScore = 0;
    for (const key of keys) {
      for (const n of namesOfKey.get(key) ?? []) {
        const score = n === name ? 1 : clubSimilarity(name, n);
        if (score > bestScore) [best, bestScore] = [key, score];
      }
    }
    const result = bestScore >= CUP_MIN_SCORE ? best : null;
    if (!result) cupUnresolved.push({ season, country, name });
    cupCache.set(ck, result);
    return result;
  };

  const games: Game[] = [];
  let cupSkipped = 0;
  let cupForeign = 0;
  for (const m of raw) {
    let home: string | null;
    let away: string | null;
    if (m.comp === "EUR") {
      // Clubs from other countries get their own rating (no league): they carry the
      // information of all the European matches our clubs played against them.
      const side = (name: string, country: string) =>
        isRatedLeague(country) ? cupKey(name, country, m.season) : `${country}:${canonical(country, name)}`;
      if (!isRatedLeague(m.homeCountry) || !isRatedLeague(m.awayCountry)) cupForeign++;
      home = side(m.home, m.homeCountry);
      away = side(m.away, m.awayCountry);
    } else {
      const map = links.get(lsKey(m.comp, m.season))!;
      home = map.get(m.home)!.key;
      away = map.get(m.away)!.key;
    }
    if (!home || !away || home === away) {
      cupSkipped++;
      continue;
    }
    games.push({ ...m, home, away });
  }

  return { games, links, unlinked, weak, cupUnresolved, cupForeign, cupSkipped };
}
