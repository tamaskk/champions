import { existsSync } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { RAW_DIR } from "../env";
import { parseEsdChamps, parseEsdLeague } from "./parse-esd";
import { parseOpenfootball } from "./parse-openfootball";
import type { RatedLeague, RawMatch } from "./types";

/**
 * Free match-result sources, downloaded from GitHub (no Apify):
 * - engsoccerdata (github.com/jalapic/engsoccerdata, MIT): top-flight results for all six
 *   leagues up to 2024/25, European Cup / Champions League 1955–2015/16.
 * - openfootball (github.com/openfootball, CC0): the seasons engsoccerdata lacks (e.g. ENG
 *   2022/23, 2025/26 and the running season), Champions League from 2016/17, Europa League.
 * Cached under data/raw/results/ (gitignored).
 */
const RESULTS_DIR = path.join(RAW_DIR, "results");
const RAW_GITHUB = "https://raw.githubusercontent.com";

const ESD_FILES: Record<RatedLeague, string> = {
  ENG: "england",
  ESP: "spain",
  ITA: "italy",
  GER: "germany",
  FRA: "france",
  NED: "holland",
};

/** Last European Cup season engsoccerdata has in full; openfootball takes over after it. */
const ESD_LAST_CUP_SEASON = 2015;
const OF_FIRST_SEASON = 2000;

const folder = (s: number) => `${s}-${String(s + 1).slice(2)}`;
const OF_LEAGUE_FILES: Record<RatedLeague, (s: number) => string> = {
  ENG: (s) => `openfootball/england/master/${folder(s)}/1-premierleague.txt`,
  ESP: (s) => `openfootball/espana/master/${folder(s)}/1-liga.txt`,
  ITA: (s) => `openfootball/italy/master/${folder(s)}/1-seriea.txt`,
  GER: (s) => `openfootball/deutschland/master/${folder(s)}/1-bundesliga.txt`,
  FRA: (s) => `openfootball/europe/master/france/${folder(s)}_fr1.txt`,
  NED: (s) => `openfootball/europe/master/netherlands/${folder(s)}_nl1.txt`,
};
const OF_CUP_FILES = (s: number) => [
  `openfootball/champions-league/master/${folder(s)}/cl.txt`,
  `openfootball/champions-league/master/${folder(s)}/el.txt`,
];

/** The season running now (start year): from July on, the new one. */
export const currentSeason = (now = new Date()) => (now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1);

/**
 * GitHub raw file, cached. Files of the last two seasons change while they are played, so their
 * cache is refreshed after 12 hours. Returns null for a file that does not exist (404).
 */
async function download(repoPath: string, opts: { refetch: boolean; live: boolean }): Promise<string | null> {
  const file = path.join(RESULTS_DIR, repoPath);
  const missing = `${file}.404`;
  if (!opts.refetch && existsSync(file)) {
    const age = Date.now() - (await stat(file)).mtimeMs;
    if (!opts.live || age < 12 * 3600_000) return readFile(file, "utf8");
  }
  if (!opts.refetch && !opts.live && existsSync(missing)) return null;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${RAW_GITHUB}/${repoPath}`, { signal: AbortSignal.timeout(60_000) });
      await mkdir(path.dirname(file), { recursive: true });
      if (res.status === 404) {
        await writeFile(missing, "");
        return null;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await writeFile(`${file}.tmp`, text);
      await rename(`${file}.tmp`, file);
      return text;
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  // Offline or GitHub down: an older cached copy is better than nothing.
  if (existsSync(file)) return readFile(file, "utf8");
  throw new Error(`Download failed: ${RAW_GITHUB}/${repoPath} (${(lastError as Error).message})`);
}

export type LoadedResults = {
  matches: RawMatch[];
  /** Which source each league season came from, e.g. "ENG 2022: openfootball". */
  coverage: Map<string, "engsoccerdata" | "openfootball">;
  missing: string[];
};

/** Every match of the six rated leagues and the European cups, from the first season on record. */
export async function loadResults(opts: { refetch: boolean; log: (s: string) => void }): Promise<LoadedResults> {
  const matches: RawMatch[] = [];
  const coverage = new Map<string, "engsoccerdata" | "openfootball">();
  const missing: string[] = [];
  const now = currentSeason();

  for (const [league, name] of Object.entries(ESD_FILES) as [RatedLeague, string][]) {
    const csv = await download(`jalapic/engsoccerdata/master/data-raw/${name}.csv`, { refetch: opts.refetch, live: false });
    if (!csv) throw new Error(`engsoccerdata ${name}.csv not found`);
    const rows = parseEsdLeague(csv, league);
    for (const m of rows) coverage.set(`${league} ${m.season}`, "engsoccerdata");
    matches.push(...rows);
    opts.log(`  engsoccerdata ${league}: ${rows.length} matches`);

    // Seasons engsoccerdata lacks (or the running ones): openfootball.
    let added = 0;
    for (let s = OF_FIRST_SEASON; s <= now; s++) {
      if (coverage.has(`${league} ${s}`)) continue;
      const text = await download(OF_LEAGUE_FILES[league](s), { refetch: opts.refetch, live: s >= now - 1 });
      const got = text ? parseOpenfootball(text, s, league) : [];
      if (got.length === 0) {
        if (league !== "NED") missing.push(`${league} ${s}`);
        continue;
      }
      coverage.set(`${league} ${s}`, "openfootball");
      matches.push(...got);
      added += got.length;
    }
    if (added) opts.log(`  openfootball ${league}: ${added} matches`);
  }

  const champs = await download("jalapic/engsoccerdata/master/data-raw/champs.csv", { refetch: opts.refetch, live: false });
  if (!champs) throw new Error("engsoccerdata champs.csv not found");
  const cups = parseEsdChamps(champs, ESD_LAST_CUP_SEASON);
  for (let s = ESD_LAST_CUP_SEASON + 1; s <= now; s++) {
    for (const file of OF_CUP_FILES(s)) {
      const text = await download(file, { refetch: opts.refetch, live: s >= now - 1 });
      if (text) cups.push(...parseOpenfootball(text, s, "EUR"));
    }
  }
  matches.push(...cups);
  opts.log(`  European cups: ${cups.length} matches`);

  return { matches, coverage, missing };
}
