# Spinvincible ⚽ – football draft game

**Draft an all-time XI from 65 years of European football and see if it can win the league unbeaten.**

Spinvincible is a football draft game: spin a random decade,
league and club, pick a player from that real squad, repeat until your XI is complete – then let a
match engine fitted on 113,000 real matches decide how good it really is.

It covers the top five European leagues (Premier League / First Division, La Liga, Serie A,
Bundesliga, Ligue 1 / Division 1) from the 1960s to today, with ~184,000 real player seasons.

> Unofficial fan game. Not affiliated with or endorsed by any club, league, federation or player.
> No logos, crests, kits or player photos are used.

---

## Contents

- [How the game works](#how-the-game-works)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Repository structure](#repository-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [The mobile app](#the-mobile-app)
- [The web app: admin and API](#the-web-app-admin-and-api)
- [Shared game logic](#shared-game-logic)
- [Data pipeline](#data-pipeline)
- [Coins, shop and accounts](#coins-shop-and-accounts)
- [Development workflow](#development-workflow)
- [Docs and roadmap](#docs-and-roadmap)
- [Legal](#legal)

---

## How the game works

1. **Spin a formation** – one of ~90 formations (4-3-3, 3-5-2, 4-4-2 diamond, 2-3-5 …). Every spot
   gets a detailed position (GK, CB, LB, DM, AM, LW, CF …).
2. **Spin for a player** – three reels, one after another: **decade → league → club**. The club
   reel only holds clubs that really played in that league in that decade.
3. **Pick a player** from that club's real squad of the decade. Each player shows his positions,
   stats and a 0–100 **decade rating**.
4. **Place him** on a spot: green = his main position, gold = one of his other positions. Players
   who fit no open spot can go to the **bench** (up to 5 substitutes, optional – **Auto-bench** fills it in one tap).
5. **Re-spin** a reel if you don't like it (3 free per draft in casual games), **swap** players,
   pick a **captain** (+1 chemistry to his neighbours), or hit **Autocomplete**.
6. **Complete the squad** → summary (rating, chemistry, overall, best partnerships) → play a
   tournament.

### Ratings

Every player season gets a **0–100 rating** (Lionel Messi 2011/12 = 100). Stats are compared with
players at the same position in the same league season, then weighted by club strength (our own
Elo from match results), so a 1965 season is judged by 1965 standards. A player picked from a
club decade uses his **decade rating** (0.7 × best season + 0.3 × second best there).

### Chemistry

Neighbouring spots are linked; a link is worth what the two players share: **legends** (5+ seasons
together) > **team-mates** > same club in another era / compatriots of the same era > compatriots /
same league and decade. Each player earns 0–3 points (main position, strong links, a team-mate
link); **Dynasty** (3+ players from one club) and **Golden generation** (4+ compatriots of one era)
add bonuses. Team chemistry (0–100) scales team strength by −8 % … +8 %.

### The match engine

Goals are Poisson-distributed with a Dixon–Coles correction, fitted on 113,775 real top-flight
matches (1960–2025). Expected goals come from each side's lines (goalkeeper, defence, midfield,
attack) against the opponent's. The stronger side wins as often as it did in reality – not always.

---

## Features

**Game modes**

| Mode | What happens |
|---|---|
| **Match** | Your XI against one real club season, home, away or neutral; quick sim or a live 90-minute clock with goals, assists and cards. |
| **League / Random League** | Your XI replaces the last-placed club of a real season; a full double round-robin with table, fixtures and top scorers. Played matchday by matchday – watch your match as a result, fast or live, or jump straight to the final table – and saved after every matchday, so you can continue it from Home at any time. Your bench rotates in when starters need a rest. |
| **Champions League / Random** | The season's 31 strongest clubs (by Elo) + your XI: pots, 8 groups, two-legged knockouts with extra time and penalties, a neutral final. |
| **Legends** | Beat legendary teams (Sacchi's Milan, Guardiola's Barcelona, …) and collect them. |
| **Daily Challenge** | One themed challenge a day with fixed rules and seeded reels – everyone gets the same draw. |
| **Head-to-head** | Matched with a random player searching at the same time; the server simulates one match for both. |
| **Mini-leagues** | Private groups with an invite code (Ranks → Leagues). Every member's daily score (100 for meeting all targets + overall + chemistry, recomputed on the server) adds up to a weekly table, Monday–Sunday. |

**Progression** – XP and levels (first win of the day ×2, daily streak multipliers – the streak counts playing, not winning, with one free streak freeze a week), 14
achievements, level-up rewards (kits, crests, card frames), a monthly Season Pass, prestige,
lifetime statistics, a leaderboard and shareable squad cards.

**Your club** – club name (shown instead of "Your XI"), kit colour and a crest generator.

**Player cards** – tap a player for his career by club, a rating-per-season chart and his links to
the rest of your squad.

---

## Tech stack

| Part | Technology |
|---|---|
| Monorepo | pnpm workspaces + Turborepo, TypeScript everywhere |
| Mobile app | Expo (React Native, Expo Router), Reanimated |
| Web / backend | Next.js (App Router, route handlers, Server Actions), Tailwind CSS |
| Database | MongoDB (Atlas; transactions need a replica set) |
| Data pipeline | TypeScript CLI (tsx), Apify web-fetch for Transfermarkt pages |
| Deploy | Vercel (web), EAS (mobile) |

---

## Repository structure

```
.
├── apps/
│   ├── mobile/                 # Expo app (the game)
│   │   └── src/
│   │       ├── app/            # Expo Router screens: index (home + draft), ranks, explore, profile
│   │       ├── components/     # draft reels, pitch, tournaments, shop, player card, …
│   │       ├── game/           # client state: progress (XP), wallet (coins), user, daily, legends, …
│   │       ├── api/client.ts   # every call to the web API
│   │       └── design/         # design tokens, type scale, icons, UI primitives
│   └── web/                    # Next.js: admin panel + public game API
│       └── src/
│           ├── app/admin/      # admin (dashboard, clubs, players, import, daily challenges, coins)
│           ├── app/api/        # public JSON API used by the app
│           ├── app/s/[id]/     # public squad page (share links)
│           └── server/         # server-only data access (Mongo), wallet, auth
├── packages/
│   ├── shared/                 # @champion/shared – game rules shared by app and server
│   │   └── src/                # formations, chemistry, match & season engine, cup, daily,
│   │                           # legends, economy (coins), store rules, auth validation, …
│   └── pipeline/               # @champion/pipeline – data import & rating CLI
│       ├── src/commands/       # tm:clubs, tm:squads, tm:positions, elo, rate, coverage, …
│       ├── src/rating/         # player rating model
│       └── data/               # club id mappings (small, committed); raw caches are ignored
├── docs/                       # research notes, store listing, skills
├── features.md                 # what's done and the feature ideas (Hungarian)
├── monetization.md             # XP, coins, store, pricing and legal rules (Hungarian)
├── CLAUDE.md                   # conventions for AI-assisted development
└── turbo.json, pnpm-workspace.yaml, package.json
```

Rule of thumb: **game logic lives in `packages/shared`** (pure functions, used by both the app and
the server), **data access lives in `apps/web/src/server`**, and **screens live in `apps/mobile`**.

---

## Getting started

### Prerequisites

- Node.js ≥ 20.9 and pnpm 10 (`corepack enable`)
- A MongoDB database – MongoDB Atlas recommended (the coin wallet uses multi-document
  transactions, which need a replica set)
- For the app: the **Expo Go** app on your phone, or an iOS simulator / Android emulator

### Install

```bash
git clone https://github.com/tamaskk/champions.git
cd champions
pnpm install          # root only; .npmrc uses node-linker=hoisted (required by Metro)
```

### Configure

Copy `.env.example` to `.env` in the repo root (the web app also reads the root `.env`) and set at
least `MONGODB_URI`:

```bash
cp .env.example .env
```

### Run

```bash
pnpm dev:web          # Next.js on http://localhost:3100 (admin at /admin, API at /api)
pnpm dev:mobile       # Expo dev server – scan the QR code with Expo Go
```

The app talks to the live backend (`https://champions-web-amber.vercel.app`) by default. To use
your local web server instead, put `EXPO_PUBLIC_API_LOCAL=1` in `apps/mobile/.env.local` (the phone
then calls the Mac running the Expo dev server on port 3100, same Wi-Fi), or set
`EXPO_PUBLIC_API_URL` to any server. Restart Expo with `npx expo start -c` after changing it.

### Data

A fresh database is empty. Import clubs in the admin (**Import**, JSON), then fill squads and ratings
with the pipeline (see [Data pipeline](#data-pipeline)). Without imported squads the draft falls
back to demo players, so the game is playable from the start.

---

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `MONGODB_URI` | web, pipeline | MongoDB connection string |
| `MONGODB_DB` | web, pipeline | Database name (default `champion`) |
| `ADMIN_USER`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | web | Admin login at `/admin-login`; the secret signs the session cookie. Without a password nobody can open `/admin` |
| `APIFY_TOKEN` | pipeline | Fetching Transfermarkt pages through Apify |
| `API_FOOTBALL_KEY` | web | Optional, for recent seasons |
| `REVENUECAT_WEBHOOK_AUTH` | web | Secret the RevenueCat webhook must send |
| `ADS_SIMULATED`, `PURCHASES_SIMULATED` | web | Staging only: simulated ads/purchases outside development |
| `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_API_LOCAL`, `EXPO_PUBLIC_API_PORT` | mobile | Where the app finds the API (default: the live Vercel backend) |

`.env` files are git-ignored; never commit real values.

---

## The mobile app

`apps/mobile` – four tabs:

- **Home** – start a game, today's Daily Challenge, your records, the starter-pack offer.
- **Ranks** – leaderboard of saved squads, their results, share and challenge them.
- **Explore** – chemistry guide, Hall of Fame, formations.
- **Profile** – account, level & XP, coins and shop, your club (name, crest), statistics,
  achievements, kits and crests, account backup.

The draft and every tournament are full-screen flows started from Home
(`src/app/index.tsx`). Client state lives in small stores under `src/game/`:

| Store | Holds |
|---|---|
| `progress.ts` | XP, level, achievements, stats, Season Pass XP, team identity, equipped cosmetics (on the device) |
| `wallet.ts` | Mirror of the server wallet; asks the server for coin claims |
| `user.ts` | Guest / registered account (userId, username, email) |
| `session.ts` | Records and Hall of Fame |
| `league-season.ts` | The league season in progress (simulated at kick-off, revealed matchday by matchday) |
| `daily.ts`, `legends.ts` | Daily attempts and the legends collection |
| `storage.ts` | Small JSON files on the device (localStorage on web) |

---

## The web app: admin and API

`apps/web` is the **launch landing page** (`/`: what the game is, and a waitlist sign-up stored in `waitlist`), the **admin panel** and the **backend** of the app.

**Admin** (`/admin`, login at `/admin-login` with the credentials from `.env`; 12-hour session): dashboard with coverage per league and decade, clubs (sortable,
paginated, squad size per club season), players (filter by league, decade, position, nationality;
sorted by rating), club and squad import (JSON, AI prompt, or the local Claude CLI), daily
challenge scheduling, **Waitlist** (launch sign-ups, CSV export), and **Coins**: find a player by username or email and credit (or correct) coins – every
change goes into the coin ledger as "admin" with a note.

**Public API** (`/api`, JSON, CORS open):

| Endpoint | Purpose |
|---|---|
| `GET /api/clubs?league=&decade=` | Clubs of a league in a decade (club reel) |
| `GET /api/squad?league=&decade=&club=` | A club's players across a decade, with ratings and positions |
| `GET /api/player?tm=` or `?name=` | A player's career (player card) |
| `GET /api/table`, `/api/season-xis`, `/api/cl-field` | Real tables, every club's likely XI, Champions League field |
| `GET /api/daily`, `/api/legends`, `/api/legend` | Daily challenge, legendary teams |
| `POST /api/users`, `/api/squads`, `/api/h2h/*` | Guest users, leaderboard, head-to-head |
| `POST /api/auth/register · login · me · password` | Email + password accounts |
| `POST /api/wallet · wallet/claim · buy · use · invite · rename` | Coin wallet (server-side) |
| `POST /api/auth/delete` | Deletes the account and all its data (password for registered accounts) |
| `POST /api/daily/score`, `/api/leagues · leagues/create · join · leave · detail` | Official daily scores and mini-leagues |
| `POST /api/iap/revenuecat` | Store purchase webhook |

Server-only code (Mongo access, wallet, auth) is in `apps/web/src/server/`.

---

## Shared game logic

`packages/shared` (`@champion/shared`) is source-only TypeScript used by the app and the server:

| Module | Contents |
|---|---|
| `formations.ts`, `formation-layout.ts` | The formation list, pitch coordinates, position codes per spot, position fit |
| `chemistry.ts` | Links, player & team chemistry, captain, squad summary |
| `match.ts`, `season.ts`, `cup.ts` | Match engine, league season with bench rotation, Champions League |
| `daily.ts`, `legends.ts`, `h2h.ts`, `tournaments.ts` | Daily challenges, legendary teams, head-to-head, modes |
| `squads.ts`, `clubs.ts`, `leagues.ts` | Data shapes, import formats, AI prompts |
| `economy.ts`, `store.ts` | Coin sources and caps, Season Pass, store catalog and its rules |
| `auth.ts` | Account validation |

---

## Data pipeline

`packages/pipeline` builds the database. Run it with `pnpm pipeline <command>`:

| Command | What it does |
|---|---|
| `tm:clubs` | Link our club seasons to Transfermarkt club ids |
| `tm:squads` | Import squads with every player's stats |
| `tm:keepers` | Clean sheets and goals conceded for goalkeepers |
| `tm:positions` | Main and other positions of every player |
| `tm:tables` | Final league tables |
| `elo` | Club strength per season (our own Elo from results) |
| `rate` | 0–100 rating for every player season + decade ratings |
| `coverage` | Club seasons with a squad, per league and decade |
| `export` | Dump the data for analysis |
| `clubs:fix` | Club list cleanup (preview; `--apply` writes) |

Common options: `--league GER,ITA`, `--decade 1970`, `--season 1975`, `--dry-run`, `--limit 20`.
Raw downloads are cached under `data/raw/` (git-ignored). Tests: `pnpm --filter @champion/pipeline test`.

**Data sources and licensing** – see `docs/research.md`. Transfermarkt data is for the private
development database only; a commercial release needs licensed or own data.

---

## Coins, shop and accounts

- **XP** comes only from playing. **Coins** come from playing (daily login, daily challenge,
  legends, head-to-head wins, level-ups, achievements, invites) and later from purchases.
- **Coins never buy a player, a rating or chemistry directly.** They buy cosmetics (card frames,
  kits, crests, pitch and reel skins, goal celebrations), convenience in casual games (extra
  re-spins, Scout, Second chance, Daily practice) and **draft boosts**: for one draft the club reel
  lands more often on clubs with 80+ (Star boost, 400 coins) or 90+ (Legend boost, 1200 coins)
  rated players – about 2–4× as often, never guaranteed; odds shown in the shop. No boosts in the
  Daily (same reels for everyone). `validateStoreItem` enforces the catalog rules.
- The **wallet lives on the server** (`wallets` + `coinLedger`, one transaction per movement, an
  idempotency key per claim). The app never sends an amount.
- **Accounts**: everyone starts as a guest; registering (name, username, email, password) keeps the
  guest's coins and squads. Passwords are salted scrypt hashes.
- Real payments (RevenueCat), rewarded ads and Apple/Google sign-in are prepared but not switched on;
  in development, purchases and ads are simulated. Details and status: `monetization.md`.

---

## Development workflow

```bash
pnpm typecheck        # all packages
pnpm lint             # all packages
pnpm --filter @champion/web add <pkg>
cd apps/mobile && npx expo install <pkg>   # mobile dependencies always via expo install
```

- Keep `react` / `react-dom` versions equal across apps (hoisted `node_modules`).
- Domain types belong in `@champion/shared`; never duplicate them in an app.
- The mobile app talks to the backend only over HTTP – no database access or secrets in the bundle.
- Next.js and Expo here are newer than most docs: check `node_modules/next/dist/docs/` and the
  versioned Expo docs before using an API from memory.
- More conventions: `CLAUDE.md`.

---

## Docs and roadmap

| File | Contents |
|---|---|
| `features.md` | Features done and ideas, prioritised |
| `monetization.md` | XP, coins, store, pricing, legal constraints and implementation status |
| `docs/research.md` | Data sources, licensing notes, architecture research |
| `docs/store-listing.md` | App store listing text |

---

## Legal

Spinvincible is an unofficial fan game. It is not affiliated with, endorsed or sponsored by any football
club, league, federation or player. Club and player names are used only to refer to real historical
seasons; no logos, crests, kits or photos are used. All trademarks belong to their owners.
