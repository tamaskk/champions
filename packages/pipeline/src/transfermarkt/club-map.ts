import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { League } from "@champion/shared";

import { PIPELINE_DATA_DIR } from "../env";

/**
 * Our club (league + season + clubSlug) → Transfermarkt club. Stored per season, because clubs
 * merge and rename over the decades. Written by `tm:clubs`, read by `tm:squads`. Committed:
 * it only holds our slugs and Transfermarkt ids.
 */
export type TmClubRef = { tmId: number; tmSlug: string; tmName: string; score: number; how: string };
export type TmClubMap = Partial<Record<League, Record<string, Record<string, TmClubRef>>>>;

/** Manual fixes, applied before name matching: { "GER": { "<clubSlug>": <tmId> } }. */
export type TmClubAliases = Partial<Record<League, Record<string, number>>>;

const MAP_FILE = path.join(PIPELINE_DATA_DIR, "transfermarkt-clubs.json");
const ALIAS_FILE = path.join(PIPELINE_DATA_DIR, "transfermarkt-club-aliases.json");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf8")) as T;
}

export const readClubMap = () => readJson<TmClubMap>(MAP_FILE, {});
export const readClubAliases = async () => {
  const { _comment, ...aliases } = await readJson<TmClubAliases & { _comment?: string }>(ALIAS_FILE, {});
  void _comment;
  return aliases as TmClubAliases;
};

/** Stable key order (league, season, slug) so diffs of the committed file stay small. */
export async function writeClubMap(map: TmClubMap) {
  const sorted: TmClubMap = {};
  for (const league of Object.keys(map).sort() as League[]) {
    const seasons = map[league] ?? {};
    sorted[league] = Object.fromEntries(
      Object.keys(seasons)
        .sort()
        .map((season) => [
          season,
          Object.fromEntries(Object.entries(seasons[season]).sort(([a], [b]) => a.localeCompare(b))),
        ]),
    );
  }
  await writeFile(MAP_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
}

/** A link good enough to reuse for other seasons: not a weak name match, not a leftover pair. */
export const CONFIDENT_SCORE = 0.85;
const isConfident = (ref: TmClubRef) =>
  ref.how === "alias" || ref.how === "known" || (ref.how === "name" && ref.score >= CONFIDENT_SCORE);

/**
 * The Transfermarkt id a club slug had in OTHER seasons (most frequent confident link). The
 * season being matched is excluded, so a weak link never confirms itself on a re-run.
 */
export function knownTmId(map: TmClubMap, league: League, clubSlug: string, exceptSeason: number): number | undefined {
  const counts = new Map<number, number>();
  for (const [season, clubs] of Object.entries(map[league] ?? {})) {
    const ref = clubs[clubSlug];
    if (ref && season !== String(exceptSeason) && isConfident(ref)) counts.set(ref.tmId, (counts.get(ref.tmId) ?? 0) + 1);
  }
  let best: number | undefined;
  let bestCount = 0;
  for (const [id, n] of counts) if (n > bestCount) [best, bestCount] = [id, n];
  return best;
}
