import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  expectedGoals,
  lineStrengths,
  outcomeChances,
  scoreProbabilities,
  seededRandom,
  simulateMatch,
} from "../src/index";

import { side } from "./helpers";

describe("seededRandom", () => {
  it("gives the same numbers for the same seed (the Daily's reels depend on it)", () => {
    const r = seededRandom("spinvincible");
    assert.deepEqual([r(), r(), r()], [0.3067743293941021, 0.9185803811997175, 0.20243010856211185]);
  });

  it("stays in [0, 1)", () => {
    const r = seededRandom("range");
    for (let i = 0; i < 5000; i++) {
      const x = r();
      assert.ok(x >= 0 && x < 1);
    }
  });
});

describe("match model", () => {
  it("a seeded match is stable: score, scorers, expected goals", () => {
    const m = simulateMatch(side("Home", 80), side("Away", 74), seededRandom("match-1"));
    assert.equal(`${m.homeGoals}-${m.awayGoals}`, "3-2");
    assert.deepEqual(m.goals, [
      { side: "away", minute: 16, scorer: "Away FW3" },
      { side: "home", minute: 29, scorer: "Home MF1" },
      { side: "home", minute: 32, scorer: "Home FW2" },
      { side: "away", minute: 59, scorer: "Away FW2" },
      { side: "home", minute: 75, scorer: "Home FW2" },
    ]);
    assert.ok(Math.abs(m.expected.home - 2.027979546244862) < 1e-9);
    assert.ok(Math.abs(m.expected.away - 1.0087984810826869) < 1e-9);
  });

  it("the goal list matches the score, in minute order", () => {
    const random = seededRandom("many");
    for (let i = 0; i < 300; i++) {
      const m = simulateMatch(side("A", 82), side("B", 79), random);
      assert.equal(m.goals.filter((g) => g.side === "home").length, m.homeGoals);
      assert.equal(m.goals.filter((g) => g.side === "away").length, m.awayGoals);
      for (let k = 1; k < m.goals.length; k++) assert.ok(m.goals[k]!.minute >= m.goals[k - 1]!.minute);
    }
  });

  it("score probabilities and outcome chances add up to 1", () => {
    const total = scoreProbabilities(1.7, 1.1).flat().reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(total - 1) < 0.01, `sum ${total}`);
    const c = outcomeChances(1.7, 1.1);
    assert.ok(Math.abs(c.win + c.draw + c.loss - 1) < 0.01);
  });

  it("the stronger side wins far more often", () => {
    const random = seededRandom("strength");
    let strong = 0;
    let weak = 0;
    for (let i = 0; i < 1000; i++) {
      // Alternate the venue so home advantage cancels out.
      const strongHome = i % 2 === 0;
      const m = strongHome
        ? simulateMatch(side("Strong", 88), side("Weak", 70), random)
        : simulateMatch(side("Weak", 70), side("Strong", 88), random);
      const [s, w] = strongHome ? [m.homeGoals, m.awayGoals] : [m.awayGoals, m.homeGoals];
      if (s > w) strong++;
      else if (w > s) weak++;
    }
    assert.ok(strong > weak * 3, `strong ${strong} vs weak ${weak}`);
  });

  it("home advantage exists, and a neutral final has none", () => {
    const a = lineStrengths(side("A", 80).xi);
    assert.ok(expectedGoals(a, a, true) > expectedGoals(a, a, false));
    const neutral = simulateMatch(side("A", 80), side("B", 80), seededRandom("n"), { neutral: true });
    assert.ok(Math.abs(neutral.expected.home - neutral.expected.away) < 1e-9);
  });

  it("chemistry scales the lines (factor 0.92–1.08)", () => {
    const base = lineStrengths(side("A", 80).xi, 1);
    const good = lineStrengths(side("A", 80).xi, 1.08);
    const bad = lineStrengths(side("A", 80).xi, 0.92);
    for (const role of ["FW", "MF", "DF", "GK"] as const) {
      assert.ok(good[role] > base[role] && base[role] > bad[role], role);
    }
  });
});
