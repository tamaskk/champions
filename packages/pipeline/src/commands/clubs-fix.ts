import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { decadeOf, seasonLabel, slugify, type League } from "@champion/shared";

import { parseCommonArgs } from "../args";
import { clubSeasonsOf, closeDb, connectDb, squadPlayersOf } from "../db";
import { PIPELINE_DATA_DIR } from "../env";
import { clubSimilarity } from "../match-clubs";
import { writeReport } from "../report";
import { readClubMap, writeClubMap, type TmClubMap } from "../transfermarkt/club-map";
import { TM_RAW_DIR } from "../transfermarkt/fetch";
import { parseLeagueClubs } from "../transfermarkt/parse-league";
import { leagueSeasonUrl, tmCompetition } from "../transfermarkt/urls";

/** An unlinked club counts as a copy of a linked one from this name similarity on. */
const DUPLICATE_SCORE = 0.75;

type Doc = { _id: unknown; league: League; season: number; club: string; clubSlug: string };
type Deletion = { league: League; season: number; club: string; clubSlug: string; copyOf: string; players: number };
type Addition = { league: League; season: number; club: string; clubSlug: string; tmId: number; tmSlug: string; tmName: string; how: string };
type Rename = { league: League; season: number; from: string; fromName: string; to: string; toName: string; players: number };

/**
 * clubs:fix – cleans up club naming in our club list, using the Transfermarkt ids from tm:clubs.
 *
 * 1. Duplicates: the same club twice in one league season under two names ("Barcelona" and
 *    "FC Barcelona"). The copy without a Transfermarkt link (so without squad or Elo) is deleted,
 *    but only if it really has no players.
 * 2. One name per club: a club that goes by different names across seasons ("Cologne" in some,
 *    "1. FC Köln" in others) gets the one it uses most (ties: the most recent), in clubSeasons,
 *    squadPlayers and the Transfermarkt club map. Otherwise the game shows it as two clubs.
 *
 * 3. With --not-in-league: club seasons Transfermarkt doesn't list for that league season at all
 *    (e.g. a club added a season early) are deleted too, unless they have players. Clubs we
 *    only failed to recognise need an alias + tm:clubs first, so they are linked, not deleted.
 *
 * 4. With --add-missing: clubs Transfermarkt lists for a league season (cached page from tm:clubs)
 *    that our list lacks are added, under the name the club has in our other seasons.
 *
 * Previews only; --apply writes.
 */
export async function clubsFix(argv: string[]) {
  const args = parseCommonArgs(argv);
  const map = await readClubMap();
  const db = await connectDb();
  try {
    const col = clubSeasonsOf(db);
    const players = squadPlayersOf(db);
    const docs = (await col
      .find({ league: { $in: args.leagues } }, { projection: { league: 1, season: 1, club: 1, clubSlug: 1 } })
      .toArray()) as unknown as Doc[];
    const docAt = new Map(docs.map((d) => [`${d.league}|${d.season}|${d.clubSlug}`, d]));
    const playerCount = async (league: League, season: number, clubSlug: string) =>
      players.countDocuments({ league, season, clubSlug });

    // Transfermarkt id per (league, slug), from every season it is linked in.
    const idOfSlug = new Map<string, Map<number, number>>();
    for (const league of args.leagues) {
      for (const clubs of Object.values(map[league] ?? {})) {
        for (const [slug, ref] of Object.entries(clubs)) {
          const k = `${league}|${slug}`;
          const counts = idOfSlug.get(k) ?? new Map<number, number>();
          counts.set(ref.tmId, (counts.get(ref.tmId) ?? 0) + 1);
          idOfSlug.set(k, counts);
        }
      }
    }
    const usualId = (league: League, slug: string) => {
      const counts = idOfSlug.get(`${league}|${slug}`);
      return counts ? [...counts].sort((a, b) => b[1] - a[1])[0][0] : undefined;
    };

    // 1. Duplicates within a league season.
    const deletions: Deletion[] = [];
    const notInLeague: { league: League; season: number; club: string }[] = [];
    for (const d of docs) {
      const linked = map[d.league]?.[String(d.season)];
      if (!linked || linked[d.clubSlug]) continue;
      let copyOf: string | undefined;
      const id = usualId(d.league, d.clubSlug);
      if (id !== undefined) copyOf = Object.entries(linked).find(([, ref]) => ref.tmId === id)?.[0];
      if (!copyOf) {
        let best = 0;
        for (const [slug, ref] of Object.entries(linked)) {
          const ours = docAt.get(`${d.league}|${d.season}|${slug}`)?.club ?? slug.replace(/-/g, " ");
          const score = Math.max(clubSimilarity(d.club, ref.tmName), clubSimilarity(d.club, ours));
          if (score > best) [best, copyOf] = [score, slug];
        }
        if (best < DUPLICATE_SCORE) copyOf = undefined;
      }
      if (copyOf) deletions.push({ league: d.league, season: d.season, club: d.club, clubSlug: d.clubSlug, copyOf, players: await playerCount(d.league, d.season, d.clubSlug) });
      else notInLeague.push({ league: d.league, season: d.season, club: d.club });
    }
    // --not-in-league: clubs Transfermarkt doesn't list for that league season at all (e.g. the
    // next season's promoted clubs added a year early). Deleted too, unless they have players.
    const wrongSeason: Deletion[] = [];
    if (args.notInLeague) {
      for (const x of notInLeague) {
        const slug = docs.find((d) => d.league === x.league && d.season === x.season && d.club === x.club)!.clubSlug;
        wrongSeason.push({ ...x, clubSlug: slug, copyOf: "", players: await playerCount(x.league, x.season, slug) });
      }
      deletions.push(...wrongSeason);
    }
    const deleting = new Set(deletions.filter((x) => x.players === 0).map((x) => `${x.league}|${x.season}|${x.clubSlug}`));

    // 2. One slug + name per Transfermarkt club.
    const renames: Rename[] = [];
    const conflicts: string[] = [];
    for (const league of args.leagues) {
      const seasonsOf = new Map<number, Map<string, number[]>>(); // tmId → slug → seasons
      for (const [season, clubs] of Object.entries(map[league] ?? {})) {
        for (const [slug, ref] of Object.entries(clubs)) {
          const bySlug = seasonsOf.get(ref.tmId) ?? new Map<string, number[]>();
          bySlug.set(slug, [...(bySlug.get(slug) ?? []), Number(season)]);
          seasonsOf.set(ref.tmId, bySlug);
        }
      }
      for (const bySlug of seasonsOf.values()) {
        if (bySlug.size < 2) continue;
        const [canonical] = [...bySlug].sort((a, b) => b[1].length - a[1].length || Math.max(...b[1]) - Math.max(...a[1]))[0];
        // Its name: the one our list uses most with that slug.
        const names = new Map<string, number>();
        for (const s of bySlug.get(canonical)!) {
          const n = docAt.get(`${league}|${s}|${canonical}`)?.club;
          if (n) names.set(n, (names.get(n) ?? 0) + 1);
        }
        const toName = [...names].sort((a, b) => b[1] - a[1])[0]?.[0];
        if (!toName) continue;
        for (const [slug, seasons] of bySlug) {
          if (slug === canonical) continue;
          for (const season of seasons) {
            const doc = docAt.get(`${league}|${season}|${slug}`);
            if (!doc) continue;
            const target = `${league}|${season}|${canonical}`;
            if (docAt.has(target) && !deleting.has(target)) {
              conflicts.push(`${league} ${seasonLabel(season)}: "${doc.club}" → "${toName}" – that name is already taken in this season`);
              continue;
            }
            renames.push({ league, season, from: slug, fromName: doc.club, to: canonical, toName, players: await playerCount(league, season, slug) });
          }
        }
      }
    }

    // 4. --add-missing: clubs on Transfermarkt's league page (cached by tm:clubs) that our list lacks.
    // They get the name the club has in our other seasons, so the game sees one club.
    const additions: Addition[] = [];
    const noPage: string[] = [];
    if (args.addMissing) {
      const seasonsInDb = [...new Set(docs.map((d) => `${d.league}|${d.season}`))];
      for (const ls of seasonsInDb) {
        const [league, seasonStr] = ls.split("|") as [League, string];
        const season = Number(seasonStr);
        const file = path.join(TM_RAW_DIR, "leagues", tmCompetition(league, season), `${season}.html`);
        if (!existsSync(file)) {
          noPage.push(`${league} ${seasonLabel(season)}`);
          continue;
        }
        const linkedIds = new Set(Object.values(map[league]?.[seasonStr] ?? {}).map((r) => r.tmId));
        for (const tm of parseLeagueClubs(await readFile(file, "utf8"))) {
          if (linkedIds.has(tm.tmId)) continue;
          // Our slug for this club in other seasons (most frequent), else one from its Transfermarkt name.
          const slugs = new Map<string, number>();
          for (const clubs of Object.values(map[league] ?? {})) {
            for (const [slug, ref] of Object.entries(clubs)) if (ref.tmId === tm.tmId) slugs.set(slug, (slugs.get(slug) ?? 0) + 1);
          }
          const known = [...slugs].sort((a, b) => b[1] - a[1])[0]?.[0];
          const knownName = known ? docs.find((d) => d.league === league && d.clubSlug === known)?.club : undefined;
          const club = knownName ?? tm.name.replace(/\s*\([^)]*\)\s*$/, "").trim();
          const clubSlug = known && knownName ? known : slugify(club);
          if (docAt.has(`${league}|${season}|${clubSlug}`) && !deleting.has(`${league}|${season}|${clubSlug}`)) {
            conflicts.push(`${league} ${seasonLabel(season)}: can't add "${club}" – that name is already taken`);
            continue;
          }
          additions.push({ league, season, club, clubSlug, tmId: tm.tmId, tmSlug: tm.tmSlug, tmName: tm.name, how: known ? "our name" : "Transfermarkt name" });
        }
      }
    }

    // Preview.
    const blocked = deletions.filter((x) => x.players > 0);
    const dupes = deletions.filter((x) => x.copyOf && x.players === 0);
    console.log(`\n1) Duplicates (same club twice in one season): ${dupes.length} to delete`);
    console.table(
      dupes
        .map((x) => ({ season: `${x.league} ${seasonLabel(x.season)}`, delete: x.club, keep: docAt.get(`${x.league}|${x.season}|${x.copyOf}`)?.club ?? x.copyOf })),
    );
    if (blocked.length) {
      console.log(`Not deleted because they have players (check by hand): ${blocked.map((x) => `${x.league} ${seasonLabel(x.season)} ${x.club} (${x.players})`).join("; ")}`);
    }

    console.log(`\n2) One name per club: ${renames.length} club seasons renamed`);
    const byClub = new Map<string, Rename[]>();
    for (const r of renames) byClub.set(`${r.league} ${r.toName}`, [...(byClub.get(`${r.league} ${r.toName}`) ?? []), r]);
    console.table(
      [...byClub].map(([club, rs]) => ({
        club,
        from: [...new Set(rs.map((r) => r.fromName))].join(", "),
        seasons: rs.length,
        players: rs.reduce((s, r) => s + r.players, 0),
      })),
    );
    if (conflicts.length) console.log(`Skipped (would clash):\n  ${conflicts.join("\n  ")}`);
    if (args.notInLeague) {
      const del = wrongSeason.filter((x) => x.players === 0);
      console.log(`\n3) Not in that league season (per Transfermarkt): ${del.length} to delete`);
      const bySeason = new Map<string, string[]>();
      for (const x of del) bySeason.set(`${x.league} ${seasonLabel(x.season)}`, [...(bySeason.get(`${x.league} ${seasonLabel(x.season)}`) ?? []), x.club]);
      console.table([...bySeason].map(([season, clubs]) => ({ season, delete: clubs.join(", ") })));
    } else {
      console.log(`\nNot in that league season per Transfermarkt: ${notInLeague.length} (--not-in-league deletes them)`);
    }

    if (args.addMissing) {
      console.log(`\n4) Missing from our list (Transfermarkt has them): ${additions.length} to add`);
      console.table(additions.map((a) => ({ season: `${a.league} ${seasonLabel(a.season)}`, add: a.club, transfermarkt: `${a.tmName} (${a.tmId})`, name: a.how })));
      if (noPage.length) console.log(`No cached Transfermarkt league page (run tm:clubs): ${noPage.join(", ")}`);
    }

    const reportFile = await writeReport("clubs-fix", { deletions, renames, conflicts, notInLeague, additions });
    console.log(`Details: ${reportFile}`);

    if (!args.apply) {
      console.log("\nPreview only – nothing was changed. Run again with --apply to write.");
      return;
    }

    // Apply: deletions first (they free names for renames), then renames, then the map file.
    let deleted = 0;
    for (const x of deletions) {
      if (x.players > 0) continue;
      // Re-check right before deleting: never remove a club season that has players.
      if ((await playerCount(x.league, x.season, x.clubSlug)) > 0) continue;
      const res = await col.deleteOne({ league: x.league, season: x.season, clubSlug: x.clubSlug });
      deleted += res.deletedCount;
    }
    let renamed = 0;
    let movedPlayers = 0;
    for (const r of renames) {
      if (await col.findOne({ league: r.league, season: r.season, clubSlug: r.to })) {
        console.log(`  skipped ${r.league} ${seasonLabel(r.season)} ${r.fromName}: "${r.toName}" exists`);
        continue;
      }
      const moved = await players.updateMany(
        { league: r.league, season: r.season, clubSlug: r.from },
        { $set: { clubSlug: r.to, updatedAt: new Date() } },
      );
      movedPlayers += moved.modifiedCount;
      await col.updateOne(
        { league: r.league, season: r.season, clubSlug: r.from },
        { $set: { clubSlug: r.to, club: r.toName, updatedAt: new Date() } },
      );
      renameInMap(map, r.league, r.season, r.from, r.to);
      renamed++;
    }
    let added = 0;
    for (const a of additions) {
      const now = new Date();
      const res = await col.updateOne(
        { league: a.league, season: a.season, clubSlug: a.clubSlug },
        {
          $setOnInsert: {
            league: a.league,
            season: a.season,
            decade: decadeOf(a.season),
            club: a.club,
            clubSlug: a.clubSlug,
            source: leagueSeasonUrl(a.league, a.season),
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
      if (res.upsertedCount) {
        const seasonMap = ((map[a.league] ??= {})[String(a.season)] ??= {});
        seasonMap[a.clubSlug] = { tmId: a.tmId, tmSlug: a.tmSlug, tmName: a.tmName, score: 1, how: "added" };
        added++;
      }
    }
    await writeClubMap(map);
    await renameInAliases(renames);
    console.log(`\nDeleted ${deleted} club seasons. Renamed ${renamed} club seasons (${movedPlayers} players moved along). Added ${added} club seasons.`);
    if (added) console.log("Next for the added clubs: tm:squads (needs Apify), then tm:keepers, tm:tables, elo (cached/free).");
  } finally {
    await closeDb();
  }
}

function renameInMap(map: TmClubMap, league: League, season: number, from: string, to: string) {
  const clubs = map[league]?.[String(season)];
  if (!clubs?.[from]) return;
  clubs[to] = clubs[from];
  delete clubs[from];
}

/** transfermarkt-club-aliases.json is keyed by our clubSlug: follow the renames. */
async function renameInAliases(renames: Rename[]) {
  const file = path.join(PIPELINE_DATA_DIR, "transfermarkt-club-aliases.json");
  if (!existsSync(file)) return;
  const aliases = JSON.parse(await readFile(file, "utf8")) as Record<string, Record<string, number> | string>;
  let changed = false;
  for (const r of renames) {
    const league = aliases[r.league];
    if (typeof league === "object" && league[r.from] !== undefined && league[r.to] === undefined) {
      league[r.to] = league[r.from];
      delete league[r.from];
      changed = true;
    }
  }
  if (changed) await writeFile(file, `${JSON.stringify(aliases, null, 2)}\n`);
}
