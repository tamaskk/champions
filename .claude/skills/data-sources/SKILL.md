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
| France 1960–1988 | pari-et-gagne.com, asse-stats.com, fr.wikipedia season pages | Weakest area. Flag gaps, don't invent. |

Transfermarkt / `felipeall/transfermarkt-api`: dev-time data gathering only, never a runtime dependency; commercial use legally risky.

## Rules

- Store **facts** (name, club, season, apps, goals, position) in our own schema with a `source` (+ URL) field per record. Never mirror another database wholesale.
- Raw downloads go to `data/raw/<source>/...` (gitignored). Curated output goes to Mongo.
- Be polite: throttle requests, cache locally, never re-fetch what's cached.
- Missing data stays missing (`null`), with the gap noted – never fabricate stats.
- If a task would make the product depend on a non-commercial-licensed source, stop and flag it.
