import { parseArgs } from "node:util";

import { DECADES, LEAGUES, parseLeague, type League } from "@champion/shared";

export type Scope = { leagues: League[]; decades: number[] | null; seasons: number[] | null; club: string | null };

export type CommonArgs = Scope & {
  overwrite: boolean;
  replaceManual: boolean;
  dryRun: boolean;
  /** clubs:fix – actually write (it only previews without it). */
  apply: boolean;
  /** clubs:fix – also delete club seasons that weren't in that league season (per Transfermarkt). */
  notInLeague: boolean;
  /** clubs:fix – add clubs Transfermarkt lists for a league season that our list lacks. */
  addMissing: boolean;
  show: boolean;
  refetch: boolean;
  concurrency: number;
  limit: number | null;
};

export function parseCommonArgs(argv: string[]): CommonArgs {
  const { values } = parseArgs({
    args: argv,
    options: {
      league: { type: "string" },
      decade: { type: "string" },
      season: { type: "string" },
      club: { type: "string" },
      overwrite: { type: "boolean", default: false },
      "replace-manual": { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      apply: { type: "boolean", default: false },
      "not-in-league": { type: "boolean", default: false },
      "add-missing": { type: "boolean", default: false },
      show: { type: "boolean", default: false },
      refetch: { type: "boolean", default: false },
      concurrency: { type: "string", default: "4" },
      limit: { type: "string" },
    },
    strict: true,
  });

  const list = (v?: string) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

  const leagues = list(values.league).map((l) => {
    const league = parseLeague(l);
    if (!league) throw new Error(`Unknown league "${l}". Use ${LEAGUES.join(", ")}.`);
    return league;
  });
  const decades = list(values.decade).map((d) => {
    const n = Number(d.length === 2 ? (Number(d) >= 60 ? `19${d}` : `20${d}`) : d);
    if (!(DECADES as readonly number[]).includes(n)) throw new Error(`Unknown decade "${d}". Use e.g. 1970 or 70.`);
    return n;
  });
  const seasons = list(values.season).map((s) => {
    const n = Number(s.slice(0, 4));
    if (!Number.isInteger(n)) throw new Error(`Bad season "${s}". Use the start year, e.g. 1975.`);
    return n;
  });
  const concurrency = Number(values.concurrency);
  const limit = values.limit ? Number(values.limit) : null;

  return {
    leagues: leagues.length ? leagues : [...LEAGUES],
    decades: decades.length ? decades : null,
    seasons: seasons.length ? seasons : null,
    club: values.club?.trim() || null,
    overwrite: values.overwrite,
    replaceManual: values["replace-manual"],
    dryRun: values["dry-run"],
    apply: values.apply,
    notInLeague: values["not-in-league"],
    addMissing: values["add-missing"],
    show: values.show,
    refetch: values.refetch,
    concurrency: Number.isInteger(concurrency) && concurrency > 0 ? Math.min(concurrency, 16) : 4,
    limit: limit && Number.isInteger(limit) && limit > 0 ? limit : null,
  };
}

/**
 * Mongo filter matching the scope, for both clubSeasons and squadPlayers. Decades become season
 * lists, because squadPlayers has no decade field.
 */
export function scopeFilter(scope: Scope) {
  let seasons = scope.seasons;
  if (scope.decades) {
    const inDecades = scope.decades.flatMap((d) => Array.from({ length: 10 }, (_, i) => d + i));
    seasons = seasons ? seasons.filter((s) => inDecades.includes(s)) : inDecades;
  }
  return {
    league: { $in: scope.leagues },
    ...(seasons ? { season: { $in: seasons } } : {}),
    ...(scope.club ? { clubSlug: scope.club } : {}),
  };
}
