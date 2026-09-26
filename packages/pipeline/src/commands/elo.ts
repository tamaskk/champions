import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { seasonLabel, type League } from "@champion/shared";

import { parseCommonArgs, scopeFilter } from "../args";
import { clubSeasonsOf, closeDb, connectDb } from "../db";
import { PIPELINE_DATA_DIR } from "../env";
import { writeReport } from "../report";
import { runElo, type TableSeason, type TeamSeason } from "../results/elo-engine";
import { resolveTeams, type ResultAliases } from "../results/resolve";
import { loadResults } from "../results/sources";
import { readClubMap } from "../transfermarkt/club-map";

/** Manual fixes: { "<LEAGUE>": { "<team name in the results file>": <Transfermarkt club id> } }. */
const ALIAS_FILE = path.join(PIPELINE_DATA_DIR, "results-aliases.json");

/**
 * elo – our own club Elo, computed from match results (free, no Apify, no ClubElo):
 * every top-flight match of ENG/ESP/ITA/GER/FRA (+ NED) since the first season on record and
 * every European Cup / Champions League (+ Europa League from 2020) match between them.
 * Teams are linked to our clubs through the Transfermarkt ids of `tm:clubs`, so run that first.
 * League seasons without results but with a final table (tm:tables) are rated from the table.
 * Saves `elo`, `eloSource`, `eloGames` on clubSeasons. Always computes the whole history (it takes
 * seconds); --league/--decade/--season only limit what is saved.
 */
export async function elo(argv: string[]) {
  const args = parseCommonArgs(argv);

  console.log("Loading results (cached under data/raw/results/)…");
  const results = await loadResults({ refetch: args.refetch, log: console.log });
  const clubMap = await readClubMap();
  const aliases: ResultAliases = {};
  if (existsSync(ALIAS_FILE)) {
    const file = JSON.parse(await readFile(ALIAS_FILE, "utf8")) as Record<string, unknown>;
    for (const [league, names] of Object.entries(file)) if (league !== "_comment") aliases[league as League] = names as Record<string, number>;
  }

  const resolved = resolveTeams(results.matches, clubMap, aliases);
  const db = await connectDb();
  try {
    const col = clubSeasonsOf(db);

    // League seasons without match results (e.g. FRA 1994/95): rated from the final table that
    // tm:tables saved, if most of the clubs have one.
    const tableDocs = await col
      .find({ table: { $type: "object" } }, { projection: { league: 1, season: 1, clubSlug: 1, table: 1 } })
      .toArray();
    const byLeagueSeason = new Map<string, typeof tableDocs>();
    for (const d of tableDocs) {
      const k = `${d.league} ${d.season}`;
      if (results.coverage.has(k)) continue;
      if (!byLeagueSeason.has(k)) byLeagueSeason.set(k, []);
      byLeagueSeason.get(k)!.push(d);
    }
    const tables: TableSeason[] = [];
    for (const [k, docs] of byLeagueSeason) {
      const [league, season] = [k.split(" ")[0], Number(k.split(" ")[1])];
      const rows = docs.flatMap((d) => {
        const ref = clubMap[d.league]?.[String(d.season)]?.[d.clubSlug];
        return ref && d.table ? [{ key: `tm:${ref.tmId}`, won: d.table.won, drawn: d.table.drawn, lost: d.table.lost }] : [];
      });
      // A table needs (nearly) every club: points only mean something against the whole league.
      const clubsThatSeason = Object.keys(clubMap[league as League]?.[String(season)] ?? {}).length;
      if (rows.length >= 10 && rows.length >= clubsThatSeason - 1) tables.push({ league, season, date: `${season + 1}-05-31`, rows });
    }
    if (tables.length) console.log(`Rated from the final table (no match results): ${tables.map((t) => `${t.league} ${seasonLabel(t.season)}`).join(", ")}`);

    const { teamSeasons, hfa } = runElo(resolved.games, tables);
    console.log(
      `${resolved.games.length} rated matches (${resolved.cupForeign} of them European matches against clubs from other countries).`,
    );

    // Latest earlier season of each team: used when a league season has neither results nor a table.
    const byKey = new Map<string, TeamSeason[]>();
    for (const ts of teamSeasons.values()) {
      if (!byKey.has(ts.key)) byKey.set(ts.key, []);
      byKey.get(ts.key)!.push(ts);
    }
    for (const list of byKey.values()) list.sort((a, b) => a.season - b.season);
    const carried = (key: string, season: number) => byKey.get(key)?.filter((t) => t.season < season).at(-1);

    const clubs = await col
      .find(scopeFilter({ ...args, club: null }), { projection: { league: 1, season: 1, clubSlug: 1, club: 1 } })
      .sort({ league: 1, season: 1, club: 1 })
      .toArray();
    console.log(`${clubs.length} club seasons in scope${args.dryRun ? " (dry run: nothing is written)" : ""}.`);

    let fromResults = 0;
    let fromTable = 0;
    let fromCarried = 0;
    const noLink: string[] = [];
    const noRating: string[] = [];
    const bySeason = new Map<string, { club: string; elo: number; games: number; source: string }[]>();

    for (const c of clubs) {
      const label = `${c.league} ${seasonLabel(c.season)} ${c.club}`;
      const ref = clubMap[c.league as League]?.[String(c.season)]?.[c.clubSlug];
      if (!ref) {
        noLink.push(label);
        continue;
      }
      const key = `tm:${ref.tmId}`;
      const ts = teamSeasons.get(`${c.league} ${c.season} ${key}`);
      const prev = ts ? undefined : carried(key, c.season);
      if (!ts && !prev) {
        noRating.push(label);
        continue;
      }
      const value = Math.round(ts ? ts.mean : prev!.end);
      const source = ts ? (ts.fromTable ? "table" : "results") : "carried";
      const games = ts ? ts.games : 0;
      if (ts?.fromTable) fromTable++;
      else if (ts) fromResults++;
      else fromCarried++;

      const lsLabel = `${c.league} ${seasonLabel(c.season)}`;
      if (!bySeason.has(lsLabel)) bySeason.set(lsLabel, []);
      bySeason.get(lsLabel)!.push({ club: c.club, elo: value, games, source });

      if (!args.dryRun) {
        await col.updateOne(
          { _id: c._id },
          { $set: { elo: value, eloSource: source, eloGames: games, updatedAt: new Date() }, $unset: { eloClub: "" } },
        );
      }
    }

    if (args.show) {
      for (const [ls, rows] of bySeason) {
        console.log(`\n${ls}`);
        console.table(rows.sort((a, b) => b.elo - a.elo));
      }
    }

    // League strength: mean Elo of each league's top 10 clubs (the full mean also drops when a
    // league grows from 18 to 20 clubs, which says nothing about its strength).
    const top10 = new Map<string, number[]>();
    for (const ts of teamSeasons.values()) {
      const k = `${ts.league} ${ts.season}`;
      if (!top10.has(k)) top10.set(k, []);
      top10.get(k)!.push(ts.mean);
    }
    const strength = (l: string, s: number) => {
      const top = (top10.get(`${l} ${s}`) ?? []).sort((a, b) => b - a).slice(0, 10);
      return top.length ? Math.round(top.reduce((a, b) => a + b, 0) / top.length) : "–";
    };
    const leagues = ["ENG", "ESP", "ITA", "GER", "FRA"];
    console.log("\nLeague strength (mean Elo of the top 10 clubs):");
    const table: Record<string, Record<string, number | string>> = {};
    for (let s = 1960; s <= new Date().getFullYear(); s += 5) table[seasonLabel(s)] = Object.fromEntries(leagues.map((l) => [l, strength(l, s)]));
    console.table(table);

    const reportFile = await writeReport("elo", {
      coverage: Object.fromEntries(results.coverage),
      homeAdvantageNow: Object.fromEntries([...hfa].map(([l, h]) => [l, Math.round(h)])),
      clubSeasonsWithoutTransfermarktLink: noLink,
      clubSeasonsWithoutRating: noRating,
      resultTeamsNotLinked: resolved.unlinked,
      weakNameLinks: resolved.weak,
      europeanTeamsNotFound: resolved.cupUnresolved,
    });

    console.log(
      `\n${args.dryRun ? "Would save" : "Saved"} Elo for ${fromResults + fromTable + fromCarried}/${clubs.length} club seasons` +
        ` (${fromResults} from match results, ${fromTable} from the final table, ${fromCarried} carried over from the last season on record).`,
    );
    if (noLink.length) console.log(`No Transfermarkt link (run tm:clubs, or wrong/duplicate club in our list): ${noLink.length}`);
    if (noRating.length) console.log(`Linked but no rating: ${noRating.length} – ${noRating.slice(0, 10).join("; ")}${noRating.length > 10 ? " …" : ""}`);
    console.log(`Details: ${reportFile}`);
    console.log("Fix a wrong team link in packages/pipeline/data/results-aliases.json: { \"FRA\": { \"<team name in results>\": <Transfermarkt id> } }");
  } finally {
    await closeDb();
  }
}
