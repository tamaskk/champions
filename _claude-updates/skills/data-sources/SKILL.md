---
name: data-sources
description: Which external football data source to use for which league/era, how to call it, and licensing constraints. Use when fetching, scraping, or importing club, squad, player, or Elo data (ClubElo, Wikidata SPARQL, API-Football, historical-lineups, worldfootball.net, FBref, Transfermarkt).
---

# Data sources

Full research: `docs/research.md`. No single source covers all 5 leagues from 1960 with a free license – combine.

## Pick by era

| Need | Source | Notes |
|---|---|---|
| Club strength, any season 1960+ | **ClubElo** | Free CSV. `http://api.clubelo.com/YYYY-MM-DD` = full ranking on a day. `http://api.clubelo.com/<ClubName>` = one club's full history (name without spaces, e.g. `ManCity`, `BayernMunich`). Primary strength signal for the sim. |
| Player ↔ club membership, all eras | **Wikidata SPARQL** | `https://query.wikidata.org/sparql`, CC0 (commercial OK). P54 (member of sports team) with P580/P582 qualifiers. No season stats. Coverage for old squads unverified – test before relying on it. Send a descriptive `User-Agent`. |
| Squads + apps/goals 1960–1988/99 | **historical-lineups.com** | Best for GER/ITA/ESP/ENG. France mostly missing. License unclear – facts only, cite source. |
| Squads 1960+, all 5 leagues | **worldfootball.net** | ToS: personal, non-commercial only. Dev reference / cross-check, not bulk import. |
| Detailed stats 1988–89+ | **FBref** | Website only. |
| 2008+ and current | **API-Football** | `API_FOOTBALL_KEY`. Check the season `coverage` object before assuming a field exists. Cache every response – free tier is rate-limited. |
| France 1960–1988 | Transfermarkt (FR1, verified 61/62 and 75/76); cross-check: pari-et-gagne.com, asse-stats.com, fr.wikipedia | Was the weakest area; Transfermarkt covers it. Flag gaps, don't invent. |

**Transfermarkt – current squad source (decided 2026-09-25).** One page per club season, `/<slug>/leistungsdaten/verein/<id>/reldata/<COMP>%26<season>/plus/1`, gives the full squad with league appearances, goals, assists, minutes and a stable player id, for all five leagues back to the 1960s (verified: GER 65/66, ITA 65/66, ESP 64/65, ENG 70/71, FRA 61/62). Competition codes: `L1`, `IT1`, `ES1`, `FR1`, England `EFD1` up to 1991/92 then `GB1`. Fetched through Apify `apify/web-fetch` (plain HTTP is blocked), ≈ $0.0015/page. Old seasons: minutes are estimates (apps × 90), assists mostly missing (stored as null). Implemented in `packages/pipeline` (`tm:clubs`, `tm:squads`).
**Licensing:** Transfermarkt's terms (§11.1) forbid automated access and reserve text-and-data mining. Accepted for the private development database only. Before any public/commercial launch: get a licence or replace the data. Every imported record keeps `source` (the page URL) and `tmPlayerId`, so Transfermarkt rows can be found and swapped out. `felipeall/transfermarkt-api` has no stats endpoint – not used.

## Rules

- Store **facts** (name, club, season, apps, goals, position) in our own schema with a `source` (+ URL) field per record. Never mirror another database wholesale.
- Raw downloads go to `data/raw/<source>/...` (gitignored). Curated output goes to Mongo.
- Be polite: throttle requests, cache locally, never re-fetch what's cached.
- Missing data stays missing (`null`), with the gap noted – never fabricate stats.
- If a task would make the product depend on a non-commercial-licensed source, stop and flag it.
