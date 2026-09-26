import { seasonLabel, type League } from "@champion/shared";

import { parseCommonArgs, scopeFilter } from "../args";
import { clubSeasonsOf, closeDb, connectDb, squadPlayersOf } from "../db";
import { writeReport } from "../report";
import { readClubMap } from "../transfermarkt/club-map";
import { FetchError, fetchCached, mapLimit } from "../transfermarkt/fetch";
import { parseSquadStats } from "../transfermarkt/parse-squad";
import { toSquadPlayers } from "../transfermarkt/to-squad";
import { clubSeasonStatsUrl, tmCompetition } from "../transfermarkt/urls";

/**
 * Bump when the importer starts saving more per player. Club seasons imported with an older
 * version are imported again (from the page cache: no new downloads) so they get the new fields;
 * players are updated in place, nothing already saved is dropped.
 */
const IMPORT_VERSION = 2;

type Outcome =
  | { status: "saved"; players: number; inserted: number }
  | { status: "dry-run"; players: number }
  | { status: "skipped-existing" }
  | { status: "no-link" }
  | { status: "cleaned"; removed: number }
  | { status: "no-data"; reason: string }
  | { status: "failed"; reason: string };

/**
 * tm:squads – for every club-season in scope: fetch the club's Transfermarkt squad statistics
 * page (cached), parse players with appearances/goals/assists/minutes, upsert into squadPlayers.
 * Club seasons that already have players are skipped unless --overwrite (which replaces them).
 */
export async function tmSquads(argv: string[]) {
  const args = parseCommonArgs(argv);
  const db = await connectDb();
  try {
    const clubSeasonsCol = clubSeasonsOf(db);
    const squads = squadPlayersOf(db);

    const all = await clubSeasonsCol
      .find(scopeFilter(args), {
        projection: { league: 1, season: 1, club: 1, clubSlug: 1, tmSquadImportedAt: 1, tmSquadImportVersion: 1 },
      })
      .sort({ league: 1, season: 1, clubSlug: 1 })
      .toArray();

    const map = await readClubMap();

    // Existing squads: players in total, how many came from Transfermarkt, and from which
    // Transfermarkt club (the id in their source URL).
    const existing = new Map<string, { n: number; tm: number; sources: string[] }>();
    const counts = await squads
      .aggregate<{ _id: { league: string; season: number; clubSlug: string }; n: number; tm: number; sources: string[] }>([
        { $match: scopeFilter(args) },
        {
          $group: {
            _id: { league: "$league", season: "$season", clubSlug: "$clubSlug" },
            n: { $sum: 1 },
            tm: { $sum: { $cond: [{ $gt: ["$tmPlayerId", null] }, 1, 0] } },
            sources: { $addToSet: { $cond: [{ $gt: ["$tmPlayerId", null] }, "$source", "$$REMOVE"] } },
          },
        },
      ])
      .toArray();
    for (const c of counts) existing.set(`${c._id.league}|${c._id.season}|${c._id.clubSlug}`, c);

    // Transfermarkt players saved from a club that is no longer the linked one (tm:clubs changed or
    // dropped the link, e.g. a wrong automatic match): that squad is wrong and is redone or removed.
    const isStale = (t: (typeof all)[number]) => {
      const e = existing.get(`${t.league}|${t.season}|${t.clubSlug}`);
      if (!e?.tm) return false;
      const ref = map[t.league as League]?.[String(t.season)]?.[t.clubSlug];
      const ids = new Set(e.sources.map((s) => s.match(/\/verein\/(\d+)\//)?.[1]));
      return !ref || ids.size !== 1 || !ids.has(String(ref.tmId));
    };

    // Filled = has players from another source (e.g. the admin's Claude import: never touched
    // without --overwrite), or a finished Transfermarkt import of the current version. Transfermarkt
    // players without the marker (interrupted run) or from an older version are imported again.
    const isFilled = (t: (typeof all)[number]) => {
      const e = existing.get(`${t.league}|${t.season}|${t.clubSlug}`);
      if (!e) return false;
      if (isStale(t)) return false;
      // Players that didn't come from Transfermarkt (e.g. the admin's Claude import):
      // kept, unless --replace-manual asks to swap them for Transfermarkt data.
      if (e.tm < e.n) return !args.replaceManual;
      return !!t.tmSquadImportedAt && (t.tmSquadImportVersion ?? 1) >= IMPORT_VERSION;
    };
    const alreadyFilled = all.filter(isFilled).length;
    const manual = all.filter((t) => {
      const e = existing.get(`${t.league}|${t.season}|${t.clubSlug}`);
      return !!e && e.tm < e.n;
    }).length;
    // A dry run writes nothing, so it can preview any club season, finished or not.
    let targets = args.overwrite || args.dryRun ? all : all.filter((t) => !isFilled(t));
    if (args.limit) targets = targets.slice(0, args.limit);

    console.log(
      `${targets.length} club seasons to import` +
        (args.overwrite
          ? " (--overwrite: existing squads are replaced)"
          : `, ${alreadyFilled} already done (skipped)` +
            (args.replaceManual
              ? `; ${manual} non-Transfermarkt squads are replaced (--replace-manual)`
              : manual
                ? `, of which ${manual} were imported another way – add --replace-manual to swap them for Transfermarkt data`
                : "")) +
        (args.dryRun ? " – dry run, nothing is written" : ""),
    );
    if (targets.length === 0) return;

    const unknownCountries = new Set<string>();
    const problems: Record<string, unknown>[] = [];
    let fetched = 0;
    let done = 0;

    const outcomes = await mapLimit(targets, args.concurrency, async (t): Promise<Outcome> => {
      const league = t.league as League;
      const label = `${league} ${seasonLabel(t.season)} ${t.club}`;
      const progress = () => `[${++done}/${targets.length}]`;
      const ref = map[league]?.[String(t.season)]?.[t.clubSlug];
      if (!ref) {
        if (isStale(t)) {
          // Linked to a wrong club before: remove those Transfermarkt players (other sources stay).
          const filter = { league, season: t.season, clubSlug: t.clubSlug, tmPlayerId: { $ne: null } };
          const removed = args.dryRun ? 0 : (await squads.deleteMany(filter)).deletedCount;
          if (!args.dryRun) await clubSeasonsCol.updateOne({ _id: t._id }, { $unset: { tmSquadImportedAt: "", tmSquadImportVersion: "" } });
          problems.push({ label, reason: "squad came from a Transfermarkt club that is no longer linked – removed" });
          console.log(`${progress()} ✗ ${label}: no Transfermarkt link; removed ${removed} players imported from a wrong club`);
          return { status: "cleaned", removed };
        }
        console.log(`${progress()} – ${label}: no Transfermarkt link (run tm:clubs first)`);
        return { status: "no-link" };
      }

      const url = clubSeasonStatsUrl(league, t.season, ref.tmId, ref.tmSlug);
      const expected = `${tmCompetition(league, t.season)}&${t.season}`;
      try {
        const page = await fetchCached(url, `squads/${league}/${t.season}/${ref.tmId}.html`, {
          refetch: args.refetch,
          // Complete Transfermarkt page (not a captcha or a truncated download).
          isValid: (html) => html.includes('name="reldata"') && html.trimEnd().endsWith("</html>"),
        });
        if (!page.fromCache) fetched++;

        const parsed = parseSquadStats(page.html);
        if (parsed.selected !== expected) {
          const reason = `Transfermarkt showed "${parsed.selected}" instead of "${expected}" (club not in that league season there?)`;
          problems.push({ label, url, reason });
          console.log(`${progress()} ✗ ${label}: ${reason}`);
          return { status: "no-data", reason };
        }
        const appearances = parsed.rows.reduce((sum, r) => sum + r.appearances, 0);
        if (parsed.rows.length === 0 || appearances === 0) {
          const reason = parsed.warnings[0] ?? "No appearances recorded";
          problems.push({ label, url, reason });
          console.log(`${progress()} ✗ ${label}: ${reason}`);
          return { status: "no-data", reason };
        }

        const target = { league, season: t.season, clubSlug: t.clubSlug, club: t.club };
        const { players, errors, duplicates, unknownCountries: unknown } = toSquadPlayers(parsed.rows, target, url);
        if (players.length === 0) {
          const reason = `No valid players (${errors[0] ?? "all rows rejected"})`;
          problems.push({ label, url, reason, errors });
          console.log(`${progress()} ✗ ${label}: ${reason}`);
          return { status: "no-data", reason };
        }
        unknown.forEach((c) => unknownCountries.add(c));
        const tooMany = parsed.teamGames !== null && parsed.rows.some((r) => r.appearances > parsed.teamGames!);
        if (errors.length || duplicates || parsed.warnings.length || tooMany) {
          problems.push({
            label,
            url,
            errors,
            duplicates,
            warnings: parsed.warnings,
            ...(tooMany ? { note: `a player has more appearances than the team's ${parsed.teamGames} games` } : {}),
          });
        }

        if (args.show) {
          console.log(`\n${label} – ${url}`);
          console.table(
            players.map((p) => ({
              name: p.name,
              pos: p.position,
              detail: p.detailedPosition,
              nat: p.nationalities?.join(",") ?? p.nationality,
              age: p.age,
              sq: p.inSquad,
              apps: p.appearances,
              goals: p.goals,
              ast: p.assists,
              min: p.minutes,
              on: p.subsOn,
              off: p.subsOff,
              yc: p.yellowCards,
              "2yc": p.secondYellowCards,
              rc: p.redCards,
              ppg: p.pointsPerGame,
              tmId: p.tmPlayerId,
            })),
          );
        }

        const scorers = [...players].sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0))[0];
        const summary = `${players.length} players, top scorer ${scorers?.name} ${scorers?.goals}${page.fromCache ? " (cache)" : ""}`;

        if (args.dryRun) {
          console.log(`${progress()} ✓ ${label}: ${summary}`);
          return { status: "dry-run", players: players.length };
        }

        const now = new Date();
        const key = { league, season: t.season, clubSlug: t.clubSlug };
        // Upsert first, then remove players that aren't in the new squad. If the run dies in
        // between, old rows linger but nothing is lost (and the missing marker triggers a redo).
        await clubSeasonsCol.updateOne({ _id: t._id }, { $unset: { tmSquadImportedAt: "" } });
        const result = await squads.bulkWrite(
          players.map(({ league: l, season, clubSlug, nameSlug, birthYear, ...rest }) => ({
            updateOne: {
              filter: { league: l, season, clubSlug, nameSlug },
              // Transfermarkt has no birth year here: keep one an earlier import saved.
              update: {
                $set: { ...rest, fetchedAt: now, updatedAt: now },
                $setOnInsert: { createdAt: now, birthYear },
              },
              upsert: true,
            },
          })),
          { ordered: false },
        );
        // Players not in the Transfermarkt squad: old rows of an interrupted import, or with
        // --overwrite / --replace-manual the previous (e.g. Claude-imported) squad.
        await squads.deleteMany({ ...key, nameSlug: { $nin: players.map((p) => p.nameSlug) } });
        await clubSeasonsCol.updateOne(
          { _id: t._id },
          { $set: { tmSquadImportedAt: now, tmSquadImportVersion: IMPORT_VERSION } },
        );
        console.log(`${progress()} ✓ ${label}: ${summary}`);
        return { status: "saved", players: players.length, inserted: result.upsertedCount };
      } catch (error) {
        const reason = (error as Error).message;
        problems.push({ label, url, reason });
        console.log(`${progress()} ✗ ${label}: ${error instanceof FetchError ? "fetch failed – " : ""}${reason}`);
        return { status: "failed", reason };
      }
    });

    const by = (s: Outcome["status"]) => outcomes.filter((o) => o.status === s).length;
    const players = outcomes.reduce((sum, o) => sum + ("players" in o ? o.players : 0), 0);
    const reportFile = await writeReport("tm-squads", {
      scope: { leagues: args.leagues, decades: args.decades, seasons: args.seasons, club: args.club },
      unknownCountries: [...unknownCountries],
      problems,
    });

    console.log(`\n${args.dryRun ? "Would import" : "Imported"} ${by("saved") + by("dry-run")}/${targets.length} club seasons, ${players} players.`);
    if (by("cleaned")) console.log(`Removed wrong squads (club no longer linked): ${by("cleaned")}.`);
    console.log(`No Transfermarkt link: ${by("no-link")} · no data on Transfermarkt: ${by("no-data")} · failed: ${by("failed")} (re-run retries these).`);
    console.log(`Pages fetched: ${fetched} (≈ $${(fetched * 0.0015).toFixed(2)} on Apify), rest from cache.`);
    if (unknownCountries.size) console.log(`Countries without a code (nationality left null): ${[...unknownCountries].join(", ")}`);
    console.log(`Details: ${reportFile}`);
  } finally {
    await closeDb();
  }
}
