import { DECADES, LEAGUES } from "@champion/shared";

import { parseCommonArgs, scopeFilter } from "../args";
import { clubSeasonsOf, closeDb, connectDb, squadPlayersOf } from "../db";
import { pct } from "../report";

/** coverage – club seasons with a squad, per league and decade. Honest numbers, gaps included. */
export async function coverage(argv: string[]) {
  const args = parseCommonArgs(argv);
  const db = await connectDb();
  try {
    const [clubCounts, squadCounts] = await Promise.all([
      clubSeasonsOf(db)
        .aggregate<{ _id: { league: string; decade: number }; n: number }>([
          { $match: scopeFilter(args) },
          { $group: { _id: { league: "$league", decade: "$decade" }, n: { $sum: 1 } } },
        ])
        .toArray(),
      squadPlayersOf(db)
        .aggregate<{ _id: { league: string; decade: number }; clubSeasons: number; players: number; tm: number }>([
          { $match: scopeFilter(args) },
          { $addFields: { decade: { $subtract: ["$season", { $mod: ["$season", 10] }] } } },
          {
            $group: {
              _id: { league: "$league", decade: "$decade", season: "$season", clubSlug: "$clubSlug" },
              players: { $sum: 1 },
              tm: { $sum: { $cond: [{ $gt: ["$tmPlayerId", null] }, 1, 0] } },
            },
          },
          {
            $group: {
              _id: { league: "$_id.league", decade: "$_id.decade" },
              clubSeasons: { $sum: 1 },
              players: { $sum: "$players" },
              tm: { $sum: "$tm" },
            },
          },
        ])
        .toArray(),
    ]);

    const find = <T extends { _id: { league: string; decade: number } }>(rows: T[], league: string, decade: number) =>
      rows.find((r) => r._id.league === league && r._id.decade === decade);

    const table: Record<string, string | number>[] = [];
    let allClubs = 0;
    let allFilled = 0;
    for (const league of LEAGUES.filter((l) => args.leagues.includes(l))) {
      for (const decade of DECADES.filter((d) => !args.decades || args.decades.includes(d))) {
        const clubs = find(clubCounts, league, decade)?.n ?? 0;
        const squad = find(squadCounts, league, decade);
        if (!clubs && !squad) continue;
        allClubs += clubs;
        allFilled += squad?.clubSeasons ?? 0;
        table.push({
          league,
          decade: `${decade}s`,
          "club seasons": clubs,
          "with squad": squad?.clubSeasons ?? 0,
          covered: pct(squad?.clubSeasons ?? 0, clubs),
          players: squad?.players ?? 0,
          "per squad": squad ? Math.round(squad.players / squad.clubSeasons) : 0,
          "from Transfermarkt": pct(squad?.tm ?? 0, squad?.players ?? 0),
        });
      }
    }
    console.table(table);
    console.log(`Total: ${allFilled}/${allClubs} club seasons have a squad (${pct(allFilled, allClubs)}).`);
  } finally {
    await closeDb();
  }
}
