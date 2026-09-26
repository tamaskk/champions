import { clubsFix } from "./commands/clubs-fix";
import { coverage } from "./commands/coverage";
import { elo } from "./commands/elo";
import { exportData } from "./commands/export";
import { rate } from "./commands/rate";
import { tmClubs } from "./commands/tm-clubs";
import { tmKeepers } from "./commands/tm-keepers";
import { tmPositions } from "./commands/tm-positions";
import { tmSquads } from "./commands/tm-squads";
import { tmTables } from "./commands/tm-tables";
import { loadEnv } from "./env";

const COMMANDS: Record<string, (argv: string[]) => Promise<void>> = {
  "tm:clubs": tmClubs,
  "tm:squads": tmSquads,
  "tm:keepers": tmKeepers,
  "tm:positions": tmPositions,
  "tm:tables": tmTables,
  elo,
  coverage,
  "clubs:fix": clubsFix,
  export: exportData,
  rate,
};

const USAGE = `Usage: pnpm --filter @champion/pipeline <command> [options]

Commands:
  tm:clubs    Link our club seasons to Transfermarkt club ids (1 page per league season)
  tm:squads   Import squads with every player stat (1 page per club season)
  tm:keepers  Add clean sheets + goals conceded to goalkeepers (~2 pages per league season)
  tm:positions Main + other positions of every player (Transfermarkt API, 100 per request, free)
  tm:tables   Final league tables: position, W/D/L, goals for/against, points (1 page per league season)
  elo         Club strength per season: our own Elo from match results (free, no Apify; after tm:clubs)
  coverage    Club seasons with a squad, per league and decade
  rate        0–100 rating for every player season (Messi 2011/12 = 100) + decade rating
  export      Dump clubSeasons + squadPlayers to data/raw/export/ (for analysis)
  clubs:fix   Club list cleanup: delete same-season duplicates, one name per club (preview; --apply writes)

Options (all commands):
  --league GER,ITA     leagues (default: all five)
  --decade 1970,80     decades
  --season 1975        seasons (start year)
  --club bayern-munich one club slug (tm:squads)
  --dry-run            fetch and parse, write nothing (tm:squads: also previews finished squads)
  --apply              clubs:fix: write the changes (without it: preview only)
  --not-in-league      clubs:fix: also delete clubs Transfermarkt doesn't list for that league season
  --add-missing        clubs:fix: add clubs Transfermarkt lists for a league season that we lack
  --show               print every parsed player with all stats
  --overwrite          tm:squads: replace squads that already have players
  --replace-manual     tm:squads: replace squads imported another way (e.g. admin's Claude button)
  --refetch            ignore the local page cache
  --concurrency 4      parallel page fetches (Apify free plan: max 5 at once)
  --limit 20           tm:squads: at most N club seasons (for test runs)`;

async function main() {
  const [command, ...argv] = process.argv.slice(2);
  const run = command ? COMMANDS[command] : undefined;
  if (!run) {
    console.log(USAGE);
    process.exitCode = command ? 1 : 0;
    return;
  }
  loadEnv();
  await run(argv);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
