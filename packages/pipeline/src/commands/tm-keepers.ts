import { seasonLabel, type League } from "@champion/shared";

import { parseCommonArgs, scopeFilter } from "../args";
import { clubSeasonsOf, closeDb, connectDb, squadPlayersOf } from "../db";
import { writeReport } from "../report";
import { fetchCached, mapLimit } from "../transfermarkt/fetch";
import { parseKeepers, type TmKeeperRow } from "../transfermarkt/parse-keepers";
import { keepersUrl, tmCompetition } from "../transfermarkt/urls";

const MAX_PAGES = 6;

/**
 * tm:keepers – goalkeeper stats (clean sheets, goals conceded) from each league season's
 * "Clean sheets" table (~2 pages per league season), attached to the goalkeepers that tm:squads
 * already saved, matched by Transfermarkt player id. Run after tm:squads.
 */
export async function tmKeepers(argv: string[]) {
  const args = parseCommonArgs(argv);
  const db = await connectDb();
  try {
    const leagueSeasons = await clubSeasonsOf(db)
      .aggregate<{ _id: { league: League; season: number } }>([
        { $match: scopeFilter({ ...args, club: null }) },
        { $group: { _id: { league: "$league", season: "$season" } } },
        { $sort: { "_id.league": 1, "_id.season": 1 } },
      ])
      .toArray();
    console.log(`${leagueSeasons.length} league seasons${args.dryRun ? " (dry run: nothing is written)" : ""}.`);

    const squads = squadPlayersOf(db);
    const problems: Record<string, unknown>[] = [];
    let fetched = 0;
    let updated = 0;
    let done = 0;

    await mapLimit(leagueSeasons, args.concurrency, async ({ _id: { league, season } }) => {
      const label = `${league} ${seasonLabel(season)}`;
      const keepers: TmKeeperRow[] = [];
      try {
        for (let page = 1; page <= MAX_PAGES; page++) {
          const res = await fetchCached(keepersUrl(league, season, page), `keepers/${tmCompetition(league, season)}/${season}-p${page}.html`, {
            refetch: args.refetch,
            isValid: (html) => html.includes("kassierte_tore") && html.trimEnd().endsWith("</html>"),
          });
          if (!res.fromCache) fetched++;
          const parsed = parseKeepers(res.html, page);
          keepers.push(...parsed.rows);
          if (!parsed.hasNextPage || parsed.rows.length === 0) break;
        }
      } catch (error) {
        problems.push({ label, reason: (error as Error).message });
        return console.log(`[${++done}/${leagueSeasons.length}] ✗ ${label}: ${(error as Error).message}`);
      }

      let matched = 0;
      const unmatched: string[] = [];
      for (const k of keepers) {
        const docs = await squads
          .find({ league, season, tmPlayerId: k.tmPlayerId }, { projection: { clubSlug: 1, appearances: 1 } })
          .toArray();
        if (docs.length === 0) {
          unmatched.push(k.name); // not in any saved squad (club not linked?)
          continue;
        }
        // Played for two clubs in the same league season: Transfermarkt only has his totals, so they
        // are split by his appearances for each club and marked as estimates.
        const totalApps = docs.reduce((s, d) => s + (d.appearances ?? 0), 0);
        const estimated = docs.length > 1;
        for (const d of docs) {
          const share = estimated ? (totalApps ? (d.appearances ?? 0) / totalApps : 1 / docs.length) : 1;
          const part = (v: number | null) => (v === null ? null : Math.round(v * share));
          const stats = { cleanSheets: part(k.cleanSheets), goalsConceded: part(k.goalsConceded), keeperStatsEstimated: estimated };
          if (args.show) {
            console.log(
              `    ${k.name} (${d.clubSlug}): ${stats.cleanSheets} clean sheets, ${stats.goalsConceded} conceded` +
                (estimated ? ` (split of ${k.cleanSheets}/${k.goalsConceded} over ${docs.length} clubs)` : ""),
            );
          }
          if (!args.dryRun) {
            await squads.updateOne({ _id: d._id }, { $set: { ...stats, updatedAt: new Date() } });
            updated++;
          }
        }
        matched++;
      }
      if (unmatched.length) problems.push({ label, unmatched });
      console.log(
        `[${++done}/${leagueSeasons.length}] ${unmatched.length ? "!" : "✓"} ${label}: ${matched}/${keepers.length} goalkeepers` +
          (unmatched.length ? ` – not attached: ${unmatched.join(", ")}` : ""),
      );
    });

    const reportFile = await writeReport("tm-keepers", { problems });
    console.log(`\n${args.dryRun ? "Would update" : "Updated"} ${args.dryRun ? "–" : updated} goalkeepers. Pages fetched: ${fetched} (≈ $${(fetched * 0.0015).toFixed(2)}).`);
    console.log(`Details: ${reportFile}`);
  } finally {
    await closeDb();
  }
}
