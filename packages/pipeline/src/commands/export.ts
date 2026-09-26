import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createGzip } from "node:zlib";

import { clubSeasonsOf, closeDb, connectDb, squadPlayersOf } from "../db";
import { RAW_DIR } from "../env";

/**
 * export – dumps clubSeasons and squadPlayers (the fields the ratings use) to
 * data/raw/export/*.jsonl.gz, for offline analysis and tuning of the rating model.
 */
export async function exportData() {
  const dir = path.join(RAW_DIR, "export");
  await mkdir(dir, { recursive: true });
  const db = await connectDb();
  try {
    const jobs = [
      {
        file: "clubSeasons.jsonl.gz",
        cursor: clubSeasonsOf(db).find({}, { projection: { _id: 0, league: 1, season: 1, club: 1, clubSlug: 1, table: 1, elo: 1, eloSource: 1 } }),
      },
      {
        file: "squadPlayers.jsonl.gz",
        cursor: squadPlayersOf(db).find(
          {},
          {
            projection: {
              _id: 0, league: 1, season: 1, clubSlug: 1, name: 1, nameSlug: 1, position: 1, detailedPosition: 1,
              nationality: 1, age: 1, appearances: 1, goals: 1, assists: 1, minutes: 1, inSquad: 1, subsOn: 1,
              subsOff: 1, yellowCards: 1, secondYellowCards: 1, redCards: 1, cleanSheets: 1, goalsConceded: 1,
              keeperStatsEstimated: 1, pointsPerGame: 1, tmPlayerId: 1,
            },
          },
        ),
      },
    ];
    for (const { file, cursor } of jobs) {
      let n = 0;
      const lines = Readable.from(
        (async function* () {
          for await (const doc of cursor) {
            n++;
            yield `${JSON.stringify(doc)}\n`;
          }
        })(),
      );
      await pipeline(lines, createGzip(), createWriteStream(path.join(dir, file)));
      console.log(`${file}: ${n} rows`);
    }
    console.log(`Written to ${path.relative(process.cwd(), dir)}`);
  } finally {
    await closeDb();
  }
}
