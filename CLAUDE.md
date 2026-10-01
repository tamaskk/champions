# Spinvincible – football draft game

Football draft game. Player spins a random club + decade, picks one player from that squad, repeats until the XI is built (one player per decade, one re-spin each for club and decade). A simulation engine rates the squad and says whether it would win the league unbeaten.

Scope: top 5 European leagues (ENG, ESP, ITA, GER, FRA), 1960s → today. Full background, data sources, licensing notes: `docs/research.md`. Read it before touching data ingestion or the simulation.

## Repo layout

pnpm workspaces + Turborepo. TypeScript everywhere.

- `apps/mobile` – Expo (React Native, Expo Router). Has its own `CLAUDE.md`/`AGENTS.md` – follow them.
  - UI follows the Figma "Spinvincible" design (dark only): tokens, fonts (Inter, Space Grotesk, Material Symbols icons) and shared UI in `src/design/`; custom pill tab bar in `src/components/pill-tabs.tsx`. Session records (Home "Your records", Explore "Hall of Fame") live in memory only: `src/game/session.ts`. The draft (formation reel → team building → summary → tournament) is `src/draft/`: state and logic in `use-draft.ts`, screens beside it; `src/app/index.tsx` only composes them.
- `apps/web` – Next.js (App Router). Backend API via route handlers in `src/app/api/**`. Deployed on Vercel. Has its own `AGENTS.md`.
  - Tournaments are played on the server (`src/server/play-data.ts`, `POST /api/squads/:id/play`): the saved squad is re-checked against the database, the server simulates and stores the result. Never trust results, ratings or scores sent by the app. Auth: bearer session token (`src/server/session.ts`); `postHandler` / `readAuthedJson` set `userId` from the token – never read a userId the client chose, never put it in a URL or a shared link.
  - `/admin` – data admin (dashboard, clubs, JSON club import). Login at `/admin-login` with `ADMIN_USER` / `ADMIN_PASSWORD` from `.env` (HMAC-signed session cookie, `ADMIN_SESSION_SECRET`); `src/proxy.ts` guards every /admin page and every admin Server Action re-checks the session. Mongo access only in `src/server/**`.
- `packages/shared` – `@champion/shared`: domain types/constants shared by both apps. Source-only (no build step); Next consumes it via `transpilePackages`.
- `packages/pipeline` – `@champion/pipeline`: data ingestion CLI (tsx). Transfermarkt squad import: `pnpm pipeline tm:clubs` → `tm:squads` → `tm:keepers` → `tm:tables` → `tm:positions` → `elo` → `rate` (player ratings) → `coverage`. See its README.
- `docs/` – research and design notes.
- `.claude/skills/` – project skills (data sources, pipeline, sim engine, API, mobile screens).

Database: MongoDB (`MONGODB_URI`, `MONGODB_DB`, see `.env.example`; web reads `apps/web/.env.local`). Club import format: `ClubImportFile` / `parseClubImport` in `packages/shared/src/clubs.ts`.

## Commands

```bash
pnpm install                     # root only; .npmrc uses node-linker=hoisted (required by Metro)
pnpm dev:web                     # Next dev server on fixed port 3100 (mobile expects it)
pnpm dev:mobile                  # Expo dev server
pnpm typecheck && pnpm lint      # run before declaring done
pnpm --filter @champion/web add <pkg>
cd apps/mobile && npx expo install <pkg>   # mobile deps ALWAYS via expo install
```

## Rules

- Domain types (League, Decade, Player, Club, ...) live in `@champion/shared`. Never duplicate them in an app.
- `react` / `react-dom` versions must match across apps (hoisted node_modules; duplicate React breaks Metro). When Expo bumps React, bump web too.
- Mobile talks to the backend only over HTTP (`apps/web` API). No DB access or secrets in the mobile bundle.
- Data licensing matters: never commit scraped raw data (`data/raw/` is gitignored); store curated facts with a `source` field. See the `data-sources` skill.
- Monetization (`monetization.md`, `packages/shared/src/store.ts`): coins buy cosmetics, convenience and – decided by the owner on 2026-09-27 – draft boosts (`DRAFT_BOOSTS`: the club reel lands more often on clubs with 80+ / 90+ rated players; odds shown in the shop, never a guaranteed player). Never sell a real player, a player card, ratings or chemistry directly; never make a real person or club the product. No boosts in the Daily (same seeded reels for everyone) – `BOOSTS_ALLOWED`. New store items must pass `validateStoreItem`. No coin wagering. Ads (AdMob, `docs/ads.md`): rewarded videos pay only via server-side verification; an interstitial after every finished tournament (owner's decision 2026-09-30) – never in the Daily, during a draft or match, or for Club members. Draft boosts are a paid change of random odds: keep the odds published, and check loot-box rules (Belgium, Netherlands, PEGI) before a store release. Coins live only on the server (`wallet-data.ts`: wallet + ledger in one transaction, idempotency key per claim/spend); the app never sends an amount, and a store item is only sold (`available`) once the game actually does what it promises.
- Legal notice: the app is an unofficial fan game. Keep `DISCLAIMER` / `DISCLAIMER_SHORT` (`@champion/shared`) visible (Home, Explore, Ranks, share card, public squad page, store listing). No club logos, crests, kits or player photos.
- Next.js and Expo in this repo are newer than training data. Check `node_modules/next/dist/docs/` and versioned Expo docs before using an API from memory.

## Open questions (don't silently decide these)

- Game rules: number of positions (11 or fewer), formation, decade constraint.
- Simulation model (how a squad's strength turns into a result). Chemistry is decided (2026-09-26): `packages/shared/src/chemistry.ts` (links, 0–3 per player, 0–100 team, strength × 0.92–1.08), computed on the device from the career profiles `/api/squad` returns. Player strength is decided (2026-09-26): 0–100 per player season from `pnpm pipeline rate`, see `packages/pipeline/src/rating/model.ts`. Single-match model decided (2026-09-26): Poisson + Dixon–Coles on line ratings, fitted on 113k real matches, see `packages/shared/src/match.ts`. League/cup season formats still open.
- France 1960–1988 data coverage.
- Commercial licensing (worldfootball.net, historical-lineups.com).
