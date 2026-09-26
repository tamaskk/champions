# @champion/pipeline

Data ingestion CLI for the Champion MongoDB. Stages follow `.claude/skills/data-pipeline`:
fetch (cached) → parse (pure) → match → load (idempotent upserts) → coverage report.

## Transfermarkt squads

Imports every club season's squad with **league appearances, goals, assists, minutes, position,
nationality and the Transfermarkt player id**, for all five leagues from the 1960s. One Transfermarkt
page per club season (plus one per league season to find the club ids).

> **Licensing:** Transfermarkt's terms forbid automated access. This is for the private development
> database only; licence or replace the data before a public/commercial launch. Every record keeps
> its `source` URL and `tmPlayerId` so it can be found and swapped. Raw pages stay in `data/raw/`
> (gitignored) – never commit them.

### Setup

1. `pnpm install` (repo root).
2. Put an Apify API token in the repo-root `.env` (or `apps/web/.env.local`):
   `APIFY_TOKEN=apify_api_...` (Apify Console → Settings → API & Integrations).
   Pages are fetched through the `apify/web-fetch` Actor because Transfermarkt blocks plain HTTP
   clients. Cost ≈ $0.0015 per page: a full run (~330 league pages + ~6,000 club pages) ≈ $10.
3. `MONGODB_URI` / `MONGODB_DB` are read from the same files as the web app.

### Run

Start small, check, then widen. All commands take `--league`, `--decade`, `--season`.

```bash
# 1. Link our club seasons to Transfermarkt club ids (writes data/transfermarkt-clubs.json)
pnpm pipeline tm:clubs --league GER --decade 1970

# 2. Try a few squads without writing to the DB
pnpm pipeline tm:squads --league GER --decade 1970 --limit 5 --dry-run

# 3. Import
pnpm pipeline tm:squads --league GER --decade 1970

# 4. Goalkeepers: clean sheets + goals conceded (run after tm:squads)
pnpm pipeline tm:keepers --league GER --decade 1970

# 5. Team data for player ratings: final tables (1 page per league season) + our own Elo (free, GitHub)
pnpm pipeline tm:tables --league GER --decade 1970 --show
pnpm pipeline elo --league GER --decade 1970 --show

# 6. See what's covered
pnpm pipeline coverage

# See exactly what gets parsed for one club season (writes nothing):
pnpm pipeline tm:squads --league GER --season 1975 --club bayern-munich --dry-run --show

# Everything, once the sample looks right (Apify free plan: max 5 runs at once):
{ pnpm pipeline tm:clubs && pnpm pipeline tm:squads --concurrency 4 && pnpm pipeline tm:keepers --concurrency 4 && pnpm pipeline tm:tables --concurrency 4 && pnpm pipeline elo && pnpm pipeline coverage; } 2>&1 | tee import-log.txt
```

- **tm:clubs** prints every league season; `!` lines have clubs that couldn't be matched (often a
  club that wasn't really in that league season in our DB – worth fixing there) and weak matches.
  The full list is in `data/raw/reports/tm-clubs-*.json`. Fix a wrong link by adding
  `"<LEAGUE>": { "<our clubSlug>": <tmId> }` to `data/transfermarkt-club-aliases.json` and re-run.
- **tm:squads** skips club seasons that already have players (e.g. imported via the admin's Claude
  button). `--overwrite` replaces them. It refuses pages where Transfermarkt shows a different
  season than asked. A finished club season gets `tmSquadImportedAt` on its `clubSeasons` doc;
  one interrupted mid-write is imported again on the next run. Problems →
  `data/raw/reports/tm-squads-*.json`.
- Every page is cached in `data/raw/transfermarkt/`; re-runs are free and fast. `--refetch` ignores
  the cache (e.g. for the current, still running season).

### What the data looks like

| Field | Notes |
|---|---|
| `position` | GK / DF / MF / FW from Transfermarkt's position group |
| `appearances`, `goals` | league only, that season; 0 for registered players who didn't play |
| `assists` | `null` when the page has no assist data (typical before the 1990s) |
| `minutes` | for old seasons Transfermarkt estimates them (appearances × 90) |
| `nationality` | first nationality, as a squad code (GER, ENG, NED, …); unknown names → `null`, listed in the run summary |
| `birthYear` | `null` – the page shows only age, which is off by one half the time |
| `inSquad`, `subsOn`, `subsOff` | matchday call-ups, substituted on/off; `null` when the era has no data |
| `yellowCards`, `secondYellowCards`, `redCards` | `null` when the era has no data |
| `pointsPerGame` | team points per game in the player's matches |
| `cleanSheets`, `goalsConceded` | goalkeepers, from `tm:keepers` (league-wide clean sheets table). A keeper who played for two clubs in the same league season gets his totals split by appearances (`keeperStatsEstimated: true`) |
| `age`, `detailedPosition`, `nationalities` | as Transfermarkt shows them for that season |
| `tmPlayerId` | stable across clubs and seasons |
| `source` | the Transfermarkt page URL |

On `clubSeasons` (per club season): `table` (position, played, won, drawn, lost, goalsFor,
goalsAgainst, points – from `tm:tables`; tables whose goals don't balance are not saved) and
`elo` / `eloSource` / `eloGames` (from `elo`, see below).

### `elo` – our own club Elo

ClubElo's API is often down, so `elo` computes the same kind of rating itself from free match
results (downloaded from GitHub, cached in `data/raw/results/`, no Apify):

- **engsoccerdata** (github.com/jalapic/engsoccerdata, MIT): every top-flight match of ENG, ESP,
  ITA, GER, FRA and NED up to 2024/25; European Cup / Champions League 1955–2015/16.
- **openfootball** (github.com/openfootball, CC0): the seasons engsoccerdata lacks (ENG 2022/23,
  2025/26, the running season), Champions League from 2016/17, Europa League 2020–2025.

How it works (`src/results/elo-engine.ts`): standard Elo, K 20, bigger moves for bigger wins,
home advantage learned per league. Promoted clubs start at the rating of the clubs they replace,
so a league's rating pool is closed and only changes through European matches (which count
double, K 40). Clubs from other countries are rated through their European matches only. That
makes ratings comparable across leagues. Scale: league average ~1450, title contenders ~1650–1750,
the very best ~1850–1950. Modern ratings run higher than 1960s ones (more European matches pump
points in), so compare within a season when mixing eras.

- Teams are linked to our clubs through the Transfermarkt ids from `tm:clubs` (run that first).
- `elo` = mean pre-match rating over the club's league matches that season; `eloGames` = how
  many. League seasons with no match results but a final table from `tm:tables` (FRA 1994/95)
  are rated from the table: each club's points against what its rating predicted
  (`eloSource: "table"`). `eloSource: "carried"` = neither: the club's last known rating.
- Always recomputes the whole history (seconds); `--league/--decade/--season` limit what is saved.
- Known gaps: no UEFA Cup / Cup Winners' Cup results, so the 1960s–80s league-vs-league
  calibration rests on the European Cup only.
- Report (`data/raw/reports/elo-*.json`): weak name links, result teams not linked, club seasons
  without a rating. Fix a link in `data/results-aliases.json`:
  `{ "FRA": { "<team name in results>": <Transfermarkt id> } }`.

## Positions: `tm:positions`

```bash
pnpm pipeline tm:positions          # every player: main + other positions, saved on all his seasons
pnpm pipeline tm:positions --show   # also prints 20 examples
```

From Transfermarkt's JSON API (the one its website uses): 100 players per request, free, no
Apify, a few minutes for all ~45k players. Cached in `data/raw/transfermarkt/positions.json`;
re-runs only fetch new players (`--refetch` for all). Saves `mainPosition` ("Centre-Forward"),
`otherPositions` (["Left Winger", "Right Winger"]) and `positions` (["CF", "LW", "RW"]).
These are career positions (the profile's "Main position" / "Other position"), the same for
every season of the player. Note: `detailedPosition` from `tm:squads` is also the player's
current main position, not the one he played that season.

## Player ratings: `rate`

```bash
pnpm pipeline rate            # rates every player season and saves `rating` + `decadeRating`
pnpm pipeline rate --dry-run  # prints the top 10 per position and the distribution, saves nothing
```

0–100 per player season, Lionel Messi 2011/12 = 100 (`src/rating/model.ts`). Every stat is compared
with the same league season's regulars at the same position (z-scores), so each era and league is
judged by its own standard; club strength (our Elo, compared across the five leagues within the
season) says what that standard is worth.

| Pos | Weights |
|---|---|
| FW | 0.40 output (goals + 0.6 × assists per 90) · 0.15 share of team goals · 0.15 playing time · 0.10 team points/game · 0.20 club |
| MF | 0.30 output · 0.20 playing time · 0.15 team points/game · 0.10 team goal difference · 0.25 club |
| DF | 0.30 team goals against · 0.25 playing time · 0.10 output · 0.10 team points/game · 0.25 club |
| GK | 0.30 goals against per 90 · 0.20 clean sheet % · 0.20 playing time · 0.10 team points/game · 0.20 club |

- Assists count only in league seasons that record them (most leagues before ~1990 don't).
- Scale per position: median regular = 60, the position's best season ever = 100.
- Under 1800 minutes the rating is pulled toward 35; red cards cost up to 5.
- `decadeRating` (for picking a player from a club decade) = 0.7 × his best + 0.3 × his second-best
  season at that club in that decade (only one season: second = best − 15).
- Typical values: regular median ~59, top 10 % from ~74, top 1 % from ~87.
- Run it again after new squads or Elo (it always recomputes everything).

## Club list cleanup: `clubs:fix`

Uses the Transfermarkt ids from `tm:clubs` to fix our club list. Preview by default:

```bash
pnpm pipeline clubs:fix            # shows what would change, writes a report
pnpm pipeline clubs:fix --apply    # does it
```

1. **Duplicates** – the same club twice in one season under two names ("Barcelona" and
   "FC Barcelona"): the copy without a Transfermarkt link (no squad, no Elo) is deleted. A copy
   that has players is never deleted, only listed.
2. **One name per club** – a club that appears under different names across seasons ("Cologne"
   and "1. FC Köln") gets the name it uses most (ties: the most recent) in `clubSeasons`,
   `squadPlayers`, `data/transfermarkt-clubs.json` and the alias file. Otherwise the game shows it
   as two clubs with half a decade each.

3. **Not in that league season** – with `--not-in-league`, club seasons Transfermarkt doesn't list
   for that league season at all (e.g. a club added a year early) are deleted too, unless they
   have players. A club we only failed to recognise needs an alias in
   `data/transfermarkt-club-aliases.json` and a `tm:clubs` run for that season first.
4. **Missing clubs** – with `--add-missing`, clubs on Transfermarkt's (cached) league page that our
   list lacks are added, under the name the club has in our other seasons. Then run `tm:squads`
   for them (Apify), and `tm:keepers`, `tm:tables`, `elo` (cached / free).
Note: re-importing an old club JSON in the admin brings the old names back.

## Tests

```bash
pnpm --filter @champion/pipeline test
```

Parser tests use saved pages in `data/raw/transfermarkt/fixtures/` (`bayern-L1-1975.html`,
`league-L1-1975.html`, `reims-FR1-1961.html`) and skip when they're missing.
