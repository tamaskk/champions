import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseCommonArgs, scopeFilter } from "../args";
import { closeDb, connectDb, squadPlayersOf } from "../db";
import { TM_RAW_DIR } from "../transfermarkt/fetch";
import { fetchPositions, type TmPositions } from "../transfermarkt/positions";

const CACHE = path.join(TM_RAW_DIR, "positions.json");
const BATCH = 100;

/**
 * tm:positions – main position + other positions of every player (Transfermarkt profile),
 * from Transfermarkt's JSON API: 100 players per request, free, a few minutes for everyone.
 * Cached in data/raw/transfermarkt/positions.json; re-runs only fetch players not cached yet.
 * Saves on squadPlayers (every season of the player): mainPosition, otherPositions, positions.
 */
export async function tmPositions(argv: string[]) {
  const args = parseCommonArgs(argv);
  const cache: Record<string, TmPositions | null> = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, "utf8")) : {};
  const saveCache = async () => {
    await mkdir(path.dirname(CACHE), { recursive: true });
    await writeFile(`${CACHE}.tmp`, JSON.stringify(cache));
    await rename(`${CACHE}.tmp`, CACHE);
  };

  const db = await connectDb();
  try {
    const col = squadPlayersOf(db);
    const ids = ((await col.distinct("tmPlayerId", scopeFilter(args))) as (number | null | undefined)[]).filter((id): id is number => typeof id === "number");
    const todo = ids.filter((id) => args.refetch || !(String(id) in cache));
    console.log(`${ids.length} players, ${todo.length} to fetch (${ids.length - todo.length} cached).`);

    for (let i = 0; i < todo.length; i += BATCH) {
      const chunk = todo.slice(i, i + BATCH);
      const got = await fetchPositions(chunk);
      for (const id of chunk) cache[String(id)] = got.get(id) ?? null;
      process.stdout.write(`\rFetched ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
      if ((i / BATCH) % 20 === 19) await saveCache();
      await new Promise((r) => setTimeout(r, 300));
    }
    if (todo.length) {
      console.log("");
      await saveCache();
    }

    const found = ids.filter((id) => cache[String(id)]?.main);
    const withOther = found.filter((id) => cache[String(id)]!.other.length > 0);
    console.log(`Main position: ${found.length}/${ids.length} players · with other positions: ${withOther.length}.`);
    const counts = new Map<string, number>();
    for (const id of found) for (const c of cache[String(id)]!.codes) counts.set(c, (counts.get(c) ?? 0) + 1);
    console.log(`Players per position (main or other): ${[...counts].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(", ")}`);
    if (args.show) {
      for (const id of withOther.slice(0, 20)) {
        const p = cache[String(id)]!;
        console.log(`  ${id}: ${p.main} + ${p.other.join(", ")} → ${p.codes.join("/")}`);
      }
    }

    if (args.dryRun) {
      console.log("Dry run: nothing written to the database.");
      return;
    }
    let updated = 0;
    const ops = found.map((id) => {
      const p = cache[String(id)]!;
      return {
        updateMany: {
          filter: { tmPlayerId: id },
          update: { $set: { mainPosition: p.main, otherPositions: p.other, positions: p.codes } },
        },
      };
    });
    for (let i = 0; i < ops.length; i += 1000) {
      const res = await col.bulkWrite(ops.slice(i, i + 1000), { ordered: false });
      updated += res.modifiedCount;
      process.stdout.write(`\rSaved ${Math.min(i + 1000, ops.length)}/${ops.length} players`);
    }
    console.log(`\nUpdated ${updated} player seasons.`);
  } finally {
    await closeDb();
  }
}
