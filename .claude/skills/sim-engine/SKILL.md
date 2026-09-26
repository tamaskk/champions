---
name: sim-engine
description: Guidance for the season simulation engine that rates a drafted all-time XI and predicts its league record. Use when designing, implementing, tuning, or testing player ratings, the era-independent strength model, or match/season simulation.
---

# Simulation engine

Input: a drafted squad (players, each tied to club + decade). Output: season record (W-D-L over a 38-game season) and whether it goes unbeaten.

## The core problem

Old eras (1960s–70s) only have apps + goals per player; modern eras have rich stats. The rating model must be **era-independent** – a 1970s player must not be penalized for missing stats.

Working hypothesis (from `docs/research.md`, not yet decided):
player rating = f(club's ClubElo that season/decade peak, player's role in squad (share of apps, goals), position).

Only use signals available for **every** era in the base rating. Richer modern stats may refine but must not dominate.

## Rules

- Keep the engine pure TypeScript in `@champion/shared` (or its own package) – no I/O, no DB, deterministic given a seed. Callable from both the API and mobile.
- Seeded RNG for all randomness; same squad + seed = same result.
- Tune against sanity anchors and write them as tests: a squad of historic champions' stars should mostly win; random mid-table players should not go unbeaten; no single era should dominate the best-possible XIs.
- Model choices are an open product decision – propose options with trade-offs, don't lock one in silently.
