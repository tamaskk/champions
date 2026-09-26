---
name: data-pipeline
description: Conventions for writing data ingestion/curation scripts that build the historical club-decade database in MongoDB. Use when writing or running scripts that download, parse, normalize, merge, or import club, squad, player, or Elo data.
---

# Data pipeline

Goal: ~700 club-decades (5 leagues × ~20 clubs × 7 decades), top 8–15 players each. Curated, not a full mirror. Start with one league (Bundesliga) end-to-end before scaling.

Source choice and licensing: see the `data-sources` skill.

## Stages

1. **fetch** – download raw source into `data/raw/<source>/<key>.<ext>`. Skip if file exists (cache = idempotency). Throttle.
2. **parse** – raw → typed records (types from `@champion/shared`). Pure functions, no I/O, unit-testable against saved raw fixtures.
3. **normalize / match** – unify club names across sources (ClubElo name ↔ Wikidata QID ↔ display name) and dedupe players. Keep an explicit alias map in the repo; never fuzzy-match silently – log low-confidence matches for review.
4. **load** – upsert into Mongo by stable natural keys (e.g. `clubId+season`, `playerId`). Re-running must not create duplicates.

## Rules

- TypeScript, run with `tsx`. Scripts live in `packages/pipeline` (`@champion/pipeline`); add a command in `src/commands/` and register it in `src/cli.ts`. Run with `pnpm pipeline <command>` from the repo root. Parsers are pure (HTML in, rows out) and tested in `test/` against saved pages in `data/raw/.../fixtures` (tests skip when the fixture is missing).
- Existing: Transfermarkt squads (`tm:clubs`, `tm:squads`, `coverage`) – see `packages/pipeline/README.md`.
- Every stage runnable alone, with CLI args for league / decade / club to allow small runs.
- Every stored record carries `source` and `fetchedAt`.
- Print a coverage summary at the end (club-decades found / expected, players per club-decade, gaps). Coverage numbers are the deliverable – report them honestly.
- Secrets from env (`MONGODB_URI`, `API_FOOTBALL_KEY`), never hardcoded.
