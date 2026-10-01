import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DAILY_POOL,
  DAILY_SCORE,
  dailyChecks,
  dailyForDate,
  dailyScore,
  dayIndex,
  normalizeLeagueCode,
  todayKey,
  validateDaily,
  weekDates,
  type DailyChallenge,
} from "../src/index";

const challenge = (rules: DailyChallenge["rules"]): DailyChallenge => ({
  id: "test",
  title: "Test",
  description: "",
  tier: "SILVER",
  xp: 100,
  rules,
});

describe("daily challenge", () => {
  it("every pool challenge is valid and has a unique id", () => {
    for (const ch of DAILY_POOL) assert.deepEqual(validateDaily({ ...ch, date: "2026-01-01" }), [], ch.id);
    assert.equal(new Set(DAILY_POOL.map((c) => c.id)).size, DAILY_POOL.length);
  });

  it("the same day gives everyone the same challenge; the pool goes round", () => {
    assert.equal(dailyForDate("2026-10-01").challenge.id, "twenties-power");
    assert.equal(dailyForDate("2026-10-02").challenge.id, "eng-80s");
    assert.equal(dailyForDate("2026-10-01").scheduled, false);
    const first = dailyForDate("2026-01-01").challenge.id;
    const again = new Date(Date.parse("2026-01-01T00:00:00Z") + DAILY_POOL.length * 86_400_000).toISOString().slice(0, 10);
    assert.equal(dailyForDate(again).challenge.id, first);
  });

  it("a scheduled challenge wins over the pool", () => {
    const fixed = { ...challenge({ targetOverall: 80 }), id: "fixed", date: "2026-10-01" };
    const d = dailyForDate("2026-10-01", [fixed]);
    assert.equal(d.challenge.id, "fixed");
    assert.equal(d.scheduled, true);
  });

  it("day keys are UTC days", () => {
    assert.equal(todayKey(new Date("2026-10-01T23:59:59Z")), "2026-10-01");
    assert.equal(dayIndex("2026-01-01"), 0);
    assert.equal(dayIndex("2026-01-02"), 1);
  });

  it("checks: each rule is met or not", () => {
    const ch = challenge({ targetChemistry: 60, targetOverall: 80 });
    assert.deepEqual(
      dailyChecks(ch, { chemistry: 60, overall: 79.4 }).map((c) => c.ok),
      [true, false],
    );
    assert.deepEqual(dailyChecks(challenge({}), { chemistry: 0, overall: 0 }), []);
  });

  it("a legend must be beaten, not drawn with", () => {
    const ch = challenge({ opponentLegend: "any-legend" });
    assert.equal(dailyChecks(ch, { chemistry: 0, overall: 0, match: { yours: 2, theirs: 1 } })[0]!.ok, true);
    assert.equal(dailyChecks(ch, { chemistry: 0, overall: 0, match: { yours: 1, theirs: 1 } })[0]!.ok, false);
    assert.equal(dailyChecks(ch, { chemistry: 0, overall: 0 })[0]!.ok, false);
  });

  it("score = success bonus + overall + chemistry", () => {
    const ch = challenge({ targetChemistry: 60, targetOverall: 80 });
    assert.deepEqual(dailyScore(ch, { chemistry: 70, overall: 84.6 }), { score: DAILY_SCORE.success + 85 + 70, success: true });
    assert.deepEqual(dailyScore(ch, { chemistry: 50, overall: 84.6 }), { score: 85 + 50, success: false });
  });
});

describe("mini-league weeks", () => {
  it("a week is Monday to Sunday (UTC)", () => {
    const week = weekDates("2026-10-01"); // a Thursday
    assert.deepEqual(week, ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    assert.deepEqual(weekDates("2026-09-28"), week);
    assert.deepEqual(weekDates("2026-10-04"), week);
  });

  it("invite codes are normalized", () => {
    assert.equal(normalizeLeagueCode(" ab-12 cd "), "AB12CD");
  });
});
