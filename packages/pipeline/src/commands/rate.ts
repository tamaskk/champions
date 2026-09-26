import { seasonLabel, type PlayerRole } from "@champion/shared";

import { parseCommonArgs, scopeFilter } from "../args";
import { clubSeasonsOf, closeDb, connectDb, squadPlayersOf } from "../db";
import { decadeRatings, playerKey, ratePlayers, type RatingInput } from "../rating/model";
import { writeReport } from "../report";

/**
 * rate – 0–100 rating for every player season (Messi 2011/12 = 100), see src/rating/model.ts.
 * Always computes everything (stats are compared within each league season, and the scale is
 * set by the best seasons ever); --league/--decade/--season only limit what is saved.
 * Saves `rating` (that season) and `decadeRating` (for picking him from that club decade).
 */
export async function rate(argv: string[]) {
  const args = parseCommonArgs(argv);
  const db = await connectDb();
  try {
    console.log("Loading clubs and players…");
    const clubs = (await clubSeasonsOf(db)
      .find({}, { projection: { _id: 0, league: 1, season: 1, clubSlug: 1, table: 1, elo: 1 } })
      .toArray()) as unknown as RatingInput["clubs"];
    const players = (await squadPlayersOf(db)
      .find(
        {},
        {
          projection: {
            _id: 0, league: 1, season: 1, clubSlug: 1, nameSlug: 1, name: 1, position: 1, appearances: 1, goals: 1,
            assists: 1, minutes: 1, pointsPerGame: 1, cleanSheets: 1, goalsConceded: 1, redCards: 1,
            secondYellowCards: 1, tmPlayerId: 1,
          },
        },
      )
      .toArray()) as unknown as (RatingInput["players"][number] & { name: string })[];
    console.log(`${clubs.length} club seasons, ${players.length} player seasons.`);

    const ratings = ratePlayers({ clubs, players });
    const decade = decadeRatings(
      players
        .filter((p) => ratings.has(playerKey(p)))
        .map((p) => ({
          league: p.league,
          clubSlug: p.clubSlug,
          season: p.season,
          player: String(p.tmPlayerId ?? p.nameSlug),
          key: playerKey(p),
          rating: ratings.get(playerKey(p))!.rating,
        })),
    );
    const unrated = players.filter((p) => !ratings.has(playerKey(p)));

    // Top 10 per position, and a few reference seasons, to check the scale.
    const rated = players.filter((p) => ratings.has(playerKey(p))).map((p) => ({ ...p, ...ratings.get(playerKey(p))! }));
    for (const pos of ["FW", "MF", "DF", "GK"] as PlayerRole[]) {
      console.log(`\nTop ${pos}:`);
      console.table(
        rated
          .filter((p) => p.position === pos)
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 10)
          .map((p) => ({ player: p.name, season: `${p.league} ${seasonLabel(p.season)}`, club: p.clubSlug, rating: p.rating })),
      );
    }
    const regulars = rated.filter((p) => p.share >= 0.35).map((p) => p.rating).sort((a, b) => a - b);
    const q = (x: number) => regulars[Math.floor(x * (regulars.length - 1))];
    console.log(`Regulars (35%+ of the minutes): 10% below ${q(0.1)}, median ${q(0.5)}, top 10% from ${q(0.9)}, top 1% from ${q(0.99)}.`);

    // Save.
    const inScope = scopeFilter({ ...args, club: null });
    const leagues = new Set(inScope.league.$in);
    const seasons = "season" in inScope ? new Set((inScope.season as { $in: number[] }).$in) : null;
    const toSave = players.filter((p) => ratings.has(playerKey(p)) && leagues.has(p.league) && (!seasons || seasons.has(p.season)));
    if (args.dryRun) {
      console.log(`\nDry run: would save ratings for ${toSave.length} player seasons.`);
    } else {
      const col = squadPlayersOf(db);
      const now = new Date();
      for (let i = 0; i < toSave.length; i += 1000) {
        await col.bulkWrite(
          toSave.slice(i, i + 1000).map((p) => ({
            updateOne: {
              filter: { league: p.league, season: p.season, clubSlug: p.clubSlug, nameSlug: p.nameSlug },
              update: { $set: { rating: ratings.get(playerKey(p))!.rating, decadeRating: decade.get(playerKey(p)) ?? null, updatedAt: now } },
            },
          })),
          { ordered: false },
        );
        process.stdout.write(`\rSaved ${Math.min(i + 1000, toSave.length)}/${toSave.length}`);
      }
      console.log("");
    }

    const reportFile = await writeReport("rate", {
      unrated: unrated.map((p) => `${p.league} ${p.season} ${p.clubSlug} ${p.name}`),
    });
    if (unrated.length) console.log(`Not rated (club season without a table): ${unrated.length} – see ${reportFile}`);
  } finally {
    await closeDb();
  }
}
