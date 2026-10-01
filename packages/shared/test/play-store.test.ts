import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DRAFT_BOOSTS,
  STORE_ITEMS,
  boostWeight,
  isInstallId,
  matchReport,
  playLegendTie,
  playMatch,
  scoreOf,
  seededRandom,
  validateStoreItem,
} from "../src/index";

import { side } from "./helpers";

describe("server-played matches", () => {
  it("a seeded match from your point of view", () => {
    const p = playMatch(side("You", 80), side("Them", 80), "random", seededRandom("play-1"));
    assert.equal(p.youAtHome, false);
    assert.deepEqual(scoreOf(p), { yours: 0, theirs: 1, outcome: "loss" });
    assert.equal(matchReport(p, "vs Them").detail, "0–1 (away)");
  });

  it("a neutral final has you as the engine's home side", () => {
    const p = playMatch(side("You", 80), side("Them", 80), "neutral", seededRandom("final"));
    assert.equal(p.youAtHome, true);
    assert.equal(p.neutral, true);
  });

  it("a level two-legged tie goes to penalties, and somebody wins", () => {
    const t = playLegendTie(side("You", 80), side("Legend", 80), seededRandom("tie-3"));
    assert.equal(t.aggYours, 3);
    assert.equal(t.aggTheirs, 3);
    assert.deepEqual(t.penalties, { yours: 4, theirs: 2 });
    assert.equal(t.won, true);
    assert.equal(t.legs[0].youAtHome, true);
    assert.equal(t.legs[1].youAtHome, false);
  });

  it("ties never end level", () => {
    const random = seededRandom("ties");
    for (let i = 0; i < 300; i++) {
      const t = playLegendTie(side("You", 80), side("Legend", 80), random);
      if (t.penalties) {
        assert.equal(t.aggYours, t.aggTheirs);
        assert.notEqual(t.penalties.yours, t.penalties.theirs);
        assert.equal(t.won, t.penalties.yours > t.penalties.theirs);
      } else assert.equal(t.won, t.aggYours > t.aggTheirs);
    }
  });
});

describe("store rules", () => {
  it("every catalog item passes the store rules", () => {
    for (const item of STORE_ITEMS) assert.deepEqual(validateStoreItem(item), [], item.id);
  });

  it("players, ratings and results are never for sale", () => {
    assert.ok(validateStoreItem({ id: "player-card", name: "Player card", price: 100, effect: { kind: "player" } }).length > 0);
    assert.ok(validateStoreItem({ id: "free", name: "Free", price: 0, effect: { kind: "kit" } }).length > 0);
    assert.ok(validateStoreItem(null).length > 0);
  });

  it("boosts only change the odds: a weight of 1 without one, more for top-rated clubs", () => {
    assert.equal(boostWeight(null, 95), 1);
    for (const id of ["star", "legend"] as const) {
      const { minRating } = DRAFT_BOOSTS[id];
      assert.ok(boostWeight(id, minRating) > boostWeight(id, minRating - 20), id);
      assert.ok(boostWeight(id, null) > 0, "no club is ever excluded");
    }
  });
});

describe("analytics", () => {
  it("install ids are opaque tokens, never emails or free text", () => {
    assert.equal(isInstallId("0123456789abcdef0123456789abcdef"), true);
    assert.equal(isInstallId("me@example.com"), false);
    assert.equal(isInstallId("short"), false);
    assert.equal(isInstallId(42), false);
  });
});
