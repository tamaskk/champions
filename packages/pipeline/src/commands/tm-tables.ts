import { seasonLabel, type League } from "@champion/shared";

import { parseCommonArgs, scopeFilter } from "../args";
import { clubSeasonsOf, closeDb, connectDb } from "../db";
import { writeReport } from "../report";
import { readClubMap } from "../transfermarkt/club-map";
import { fetchCached, mapLimit } from "../transfermarkt/fetch";
import { parseLeagueTable } from "../transfermarkt/parse-table";
import { leagueTableUrl, tmCompetition } from "../transfermarkt/urls";

/**
 * tm:tables – final league table per league season (1 page each): position, W/D/L, goals for and
 * against, points. Saved on each clubSeasons doc as `table`. Needs tm:clubs (club id links).
 */
export async function tmTables(argv: string[]) {
  const args = parseCommonArgs(argv);
  const db = await connectDb();
  try {
    const col = clubSeasonsOf(db);
    const groups = await col
      .aggregate<{ _id: { league: League; season: number }; clubs: { _id: unknown; clubSlug: string; club: string }[] }>([
        { $match: scopeFilter({ ...args, club: null }) },
        {
          $group: {
            _id: { league: "$league", season: "$season" },
            clubs: { $push: { _id: "$_id", clubSlug: "$clubSlug", club: "$club" } },
          },
        },
        { $sort: { "_id.league": 1, "_id.season": 1 } },
      ])
      .toArray();
    const map = await readClubMap();
    console.log(`${groups.length} league seasons${args.dryRun ? " (dry run: nothing is written)" : ""}.`);

    const problems: Record<string, unknown>[] = [];
    let fetched = 0;
    let saved = 0;
    let done = 0;

    await mapLimit(groups, args.concurrency, async ({ _id: { league, season }, clubs }) => {
      const label = `${league} ${seasonLabel(season)}`;
      const progress = `[${++done}/${groups.length}]`;
      try {
        const page = await fetchCached(leagueTableUrl(league, season), `tables/${tmCompetition(league, season)}/${season}.html`, {
          refetch: args.refetch,
          isValid: (html) => html.includes('class="items"') && html.trimEnd().endsWith("</html>"),
        });
        if (!page.fromCache) fetched++;
        const { rows, problems: tableProblems } = parseLeagueTable(page.html);
        if (rows.length === 0 || tableProblems.length) {
          problems.push({ label, problems: tableProblems.length ? tableProblems : ["no rows"] });
          return console.log(`${progress} ✗ ${label}: table not saved – ${tableProblems[0] ?? "no rows"}`);
        }

        const byTmId = new Map(rows.map((r) => [r.tmId, r]));
        const missing: string[] = [];
        for (const c of clubs) {
          const ref = map[league]?.[String(season)]?.[c.clubSlug];
          const row = ref && byTmId.get(ref.tmId);
          if (!row) {
            missing.push(c.club);
            // Not (or no longer) linked: drop a table line an earlier, wrong link may have saved.
            if (!args.dryRun) await col.updateOne({ _id: c._id as never }, { $unset: { table: "" } });
            continue;
          }
          const table = {
            position: row.position,
            played: row.played,
            won: row.won,
            drawn: row.drawn,
            lost: row.lost,
            goalsFor: row.goalsFor,
            goalsAgainst: row.goalsAgainst,
            points: row.points,
          };
          if (args.show) console.log(`    ${String(table.position).padStart(2)}. ${c.club}: ${table.played} ${table.won}-${table.drawn}-${table.lost} ${table.goalsFor}:${table.goalsAgainst} ${table.points} pts`);
          if (!args.dryRun) {
            await col.updateOne({ _id: c._id as never }, { $set: { table, updatedAt: new Date() } });
            saved++;
          }
        }
        if (missing.length) problems.push({ label, notLinked: missing });
        console.log(
          `${progress} ${missing.length ? "!" : "✓"} ${label}: ${clubs.length - missing.length}/${clubs.length} clubs` +
            (missing.length ? ` – no table line for ${missing.join(", ")} (run tm:clubs)` : ""),
        );
      } catch (error) {
        problems.push({ label, reason: (error as Error).message });
        console.log(`${progress} ✗ ${label}: ${(error as Error).message}`);
      }
    });

    const reportFile = await writeReport("tm-tables", { problems });
    console.log(`\nSaved ${saved} table lines. Pages fetched: ${fetched} (≈ $${(fetched * 0.0015).toFixed(2)}). Details: ${reportFile}`);
  } finally {
    await closeDb();
  }
}
