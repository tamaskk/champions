import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cupProgress, roundRobin, seededRandom, simulateCup, simulateSeason, type CupTeam, type SeasonTeam } from "../src/index";

import { side } from "./helpers";

const league = (): SeasonTeam[] => [90, 84, 78, 72, 66, 60].map((x, i) => ({ id: `t${i}`, ...side(`Team ${i}`, x) }));

describe("league season", () => {
  it("round robin: everyone meets everyone home and away", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const fixtures = roundRobin(ids);
    assert.equal(fixtures.length, ids.length * (ids.length - 1));
    const pairs = new Set(fixtures.map((f) => `${f.home}>${f.away}`));
    assert.equal(pairs.size, fixtures.length);
    for (const home of ids) for (const away of ids) if (home !== away) assert.ok(pairs.has(`${home}>${away}`));
    // Nobody plays twice in a round.
    for (const round of new Set(fixtures.map((f) => f.round))) {
      const playing = fixtures.filter((f) => f.round === round).flatMap((f) => [f.home, f.away]);
      assert.equal(new Set(playing).size, playing.length, `round ${round}`);
    }
  });

  it("a seeded season is stable", () => {
    const s = simulateSeason(league(), 3, seededRandom("season-1"));
    assert.deepEqual(
      s.table.map((r) => [r.id, r.points, r.won, r.drawn, r.lost]),
      [
        ["t0", 24, 7, 3, 0],
        ["t1", 22, 6, 4, 0],
        ["t2", 15, 4, 3, 3],
        ["t3", 11, 3, 2, 5],
        ["t4", 6, 1, 3, 6],
        ["t5", 3, 0, 3, 7],
      ],
    );
  });

  it("the table adds up", () => {
    for (const pointsWin of [2, 3]) {
      const s = simulateSeason(league(), pointsWin, seededRandom(`table-${pointsWin}`));
      for (const r of s.table) {
        assert.equal(r.played, 10);
        assert.equal(r.won + r.drawn + r.lost, r.played);
        assert.equal(r.points, r.won * pointsWin + r.drawn);
      }
      const sum = (pick: (r: (typeof s.table)[number]) => number) => s.table.reduce((n, r) => n + pick(r), 0);
      assert.equal(sum((r) => r.goalsFor), sum((r) => r.goalsAgainst));
      assert.equal(sum((r) => r.won), sum((r) => r.lost));
      assert.deepEqual(s.table.map((r) => r.position), [1, 2, 3, 4, 5, 6]);
      for (let i = 1; i < s.table.length; i++) assert.ok(s.table[i - 1]!.points >= s.table[i]!.points);
    }
  });
});

describe("cup", () => {
  const field = (): CupTeam[] =>
    Array.from({ length: 32 }, (_, i) => ({
      id: `c${i}`,
      league: (["ENG", "ESP", "ITA", "GER", "FRA"] as const)[i % 5]!,
      elo: 2000 - i * 10,
      ...side(`Club ${i}`, 92 - i),
    }));

  it("32 teams: 8 groups, then 8-4-2-1 ties and one champion", () => {
    const c = simulateCup(field(), seededRandom("cup-1"));
    assert.equal(c.groups.length, 8);
    for (const g of c.groups) assert.equal(g.teams.length, 4);
    assert.equal(new Set(c.groups.flatMap((g) => g.teams)).size, 32);
    assert.deepEqual(
      c.rounds.map((r) => [r.name, r.ties.length]),
      [
        ["Round of 16", 8],
        ["Quarter-finals", 4],
        ["Semi-finals", 2],
        ["Final", 1],
      ],
    );
    assert.equal(c.championId, c.rounds.at(-1)!.ties[0]!.winner);
    assert.equal(c.championId, "c0");
  });

  it("every tie's winner goes on to the next round", () => {
    const c = simulateCup(field(), seededRandom("cup-2"));
    for (let i = 0; i + 1 < c.rounds.length; i++) {
      const next = new Set(c.rounds[i + 1]!.ties.flatMap((t) => [t.a, t.b]));
      for (const tie of c.rounds[i]!.ties) {
        assert.ok(tie.winner === tie.a || tie.winner === tie.b);
        assert.ok(next.has(tie.winner), `${c.rounds[i]!.name}: ${tie.winner}`);
      }
    }
  });

  it("the same seed draws and plays the same cup", () => {
    const a = simulateCup(field(), seededRandom("cup-3"));
    const b = simulateCup(field(), seededRandom("cup-3"));
    assert.deepEqual(a, b);
  });
});

describe("cup, match by match", () => {
  // Your side strong enough to go deep, so the knockout legs are covered.
  const withYou = (): CupTeam[] => [
    { id: "you", league: null, ...side("You", 99) },
    ...Array.from({ length: 31 }, (_, i) => ({
      id: `c${i}`,
      league: (["ENG", "ESP", "ITA", "GER", "FRA"] as const)[i % 5]!,
      elo: 2000 - i * 10,
      ...side(`Club ${i}`, 80 - i),
    })),
  ];
  const cup = simulateCup(withYou(), seededRandom("run-1"), { detailFor: "you" });

  it("keeps the full match for your matches only", () => {
    const mine = cup.matches.filter((m) => m.home === "you" || m.away === "you");
    assert.ok(mine.length >= 6);
    for (const m of mine) {
      assert.ok(m.detail, m.stage);
      // The 90 minutes; extra-time goals come on top of them.
      const extra = (m.extraTime?.home ?? 0) + (m.extraTime?.away ?? 0);
      assert.equal(m.detail.result.homeGoals + m.detail.result.awayGoals + extra, m.homeGoals + m.awayGoals, m.stage);
    }
    assert.ok(cup.matches.filter((m) => m.home !== "you" && m.away !== "you").every((m) => !m.detail));
  });

  it("nothing is known before the first match, everything after the last", () => {
    const start = cupProgress(cup, "you", 0);
    assert.equal(start.done, false);
    assert.equal(start.next, start.matches[0]);
    assert.equal(start.view.rounds.length, 0);
    assert.equal(start.view.championId, "");
    for (const g of start.view.groups) assert.ok(g.result.table.every((r) => r.played === 0));
    const end = cupProgress(cup, "you", start.matches.length);
    assert.equal(end.done, true);
    assert.equal(end.view, cup);
  });

  it("every group is shown after the same matchday", () => {
    for (let md = 1; md <= 6; md++) {
      const p = cupProgress(cup, "you", md);
      for (const g of p.view.groups) {
        assert.ok(g.result.table.every((r) => r.played === md), `MD${md} group ${g.name}`);
        assert.ok(g.result.fixtures.every((f) => f.round <= md));
      }
    }
  });

  it("a knockout round appears when it is drawn; no winner until both legs are played", () => {
    const total = cupProgress(cup, "you", 0).matches.length;
    assert.ok(total > 6, "this seed takes you into the knockouts");
    const drawn = cupProgress(cup, "you", 6).view.rounds;
    assert.equal(drawn.length, 1);
    assert.equal(drawn[0]!.name, "Round of 16");
    assert.ok(drawn[0]!.ties.every((t) => t.legs.length === 0 && t.winner === ""));
    const firstLeg = cupProgress(cup, "you", 7).view.rounds;
    assert.ok(firstLeg[0]!.ties.every((t) => t.legs.length === 1 && t.winner === ""));
    if (total > 8) {
      const through = cupProgress(cup, "you", 8).view.rounds;
      assert.deepEqual(through[0], cup.rounds[0]);
      assert.equal(through[1]?.name, "Quarter-finals");
    }
  });

  it("never shows more than has been played", () => {
    const total = cupProgress(cup, "you", 0).matches.length;
    for (let n = 0; n < total; n++) {
      const p = cupProgress(cup, "you", n);
      assert.equal(p.view.matches.length, n);
      assert.equal(p.view.scorers.length, 0);
      assert.equal(p.next, p.matches[n]);
    }
  });
});
