import { seasonLabel, type League } from "@champion/shared";

import { parseCommonArgs, scopeFilter } from "../args";
import { clubSeasonsOf, closeDb, connectDb } from "../db";
import { matchClubs } from "../match-clubs";
import { writeReport } from "../report";
import {
  CONFIDENT_SCORE,
  knownTmId,
  readClubAliases,
  readClubMap,
  writeClubMap,
  type TmClubRef,
} from "../transfermarkt/club-map";
import { fetchCached, mapLimit } from "../transfermarkt/fetch";
import { parseLeagueClubs, type TmClub } from "../transfermarkt/parse-league";
import { leagueSeasonUrl, tmCompetition } from "../transfermarkt/urls";

type OurClub = { club: string; clubSlug: string };

/**
 * tm:clubs – links every club-season in our DB to its Transfermarkt club id.
 * One Transfermarkt page per league season (~330 pages for everything).
 */
export async function tmClubs(argv: string[]) {
  const args = parseCommonArgs(argv);
  const db = await connectDb();
  try {
    const groups = await clubSeasonsOf(db)
      .aggregate<{ _id: { league: League; season: number }; clubs: OurClub[] }>([
        { $match: scopeFilter({ ...args, club: null }) },
        { $group: { _id: { league: "$league", season: "$season" }, clubs: { $push: { club: "$club", clubSlug: "$clubSlug" } } } },
        { $sort: { "_id.league": 1, "_id.season": 1 } },
      ])
      .toArray();
    if (groups.length === 0) return console.log("No club seasons in the DB for this scope.");

    const [map, aliases] = await Promise.all([readClubMap(), readClubAliases()]);
    console.log(`${groups.length} league seasons to link${args.dryRun ? " (dry run: map file not written)" : ""}.`);

    let fetched = 0;
    const review: unknown[] = [];
    const failed: { league: League; season: number; error: string }[] = [];
    let linked = 0;
    let total = 0;

    await mapLimit(groups, args.concurrency, async ({ _id: { league, season }, clubs }) => {
      const label = `${league} ${seasonLabel(season)}`;
      total += clubs.length;
      let tmClubsList: TmClub[];
      try {
        const page = await fetchCached(leagueSeasonUrl(league, season), `leagues/${tmCompetition(league, season)}/${season}.html`, {
          refetch: args.refetch,
          isValid: (html) => parseLeagueClubs(html).length >= 8,
        });
        if (!page.fromCache) fetched++;
        tmClubsList = parseLeagueClubs(page.html);
      } catch (error) {
        failed.push({ league, season, error: (error as Error).message });
        return console.log(`✗ ${label}: ${(error as Error).message}`);
      }

      const { matches, unmatchedOurs, unmatchedTheirs } = matchClubs(clubs, tmClubsList, {
        oursName: (o) => o.club,
        theirsName: (t) => t.name,
        theirsId: (t) => t.tmId,
        known: (o) => {
          const alias = aliases[league]?.[o.clubSlug];
          if (alias !== undefined) return { id: alias, how: "alias" };
          const id = knownTmId(map, league, o.clubSlug, season);
          return id === undefined ? undefined : { id, how: "known" };
        },
      });

      // Rebuilt from scratch: a club that no longer matches must not keep an old (maybe wrong) link.
      const seasonMap: Record<string, TmClubRef> = {};
      for (const m of matches) {
        seasonMap[m.ours.clubSlug] = {
          tmId: m.theirs.tmId,
          tmSlug: m.theirs.tmSlug,
          tmName: m.theirs.name,
          score: Math.round(m.score * 100) / 100,
          how: m.how,
        };
        if (m.how === "last-left" || (m.how === "name" && m.score < CONFIDENT_SCORE)) {
          review.push({ league, season, ours: m.ours.club, transfermarkt: m.theirs.name, tmId: m.theirs.tmId, score: m.score, how: m.how });
        }
      }
      (map[league] ??= {})[String(season)] = seasonMap;
      linked += matches.length;

      const problems = unmatchedOurs.length + unmatchedTheirs.length;
      const status = problems ? "!" : "✓";
      console.log(
        `${status} ${label}: ${matches.length}/${clubs.length} linked` +
          (tmClubsList.length !== clubs.length ? ` (Transfermarkt lists ${tmClubsList.length} clubs, we have ${clubs.length})` : ""),
      );
      if (problems) {
        review.push({
          league,
          season,
          notOnTransfermarkt: unmatchedOurs.map((o) => o.club),
          onlyOnTransfermarkt: unmatchedTheirs.map((t) => `${t.name} (${t.tmId})`),
        });
        if (unmatchedOurs.length) console.log(`    ours, not matched: ${unmatchedOurs.map((o) => o.club).join(", ")}`);
        if (unmatchedTheirs.length) console.log(`    Transfermarkt, not matched: ${unmatchedTheirs.map((t) => `${t.name} (${t.tmId})`).join(", ")}`);
      }
    });

    if (!args.dryRun) await writeClubMap(map);
    const reportFile = await writeReport("tm-clubs", { review, failed });

    console.log(`\nLinked ${linked}/${total} club seasons. Pages fetched: ${fetched} (rest from cache).`);
    console.log(`To review: ${review.length} (weak matches and unmatched clubs) → ${reportFile}`);
    if (review.length) {
      console.log("Fix a wrong or missing link in packages/pipeline/data/transfermarkt-club-aliases.json, then re-run.");
    }
    if (failed.length) console.log(`Failed league seasons: ${failed.length} (re-run to retry).`);
  } finally {
    await closeDb();
  }
}
