import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  chemistryPreview,
  swapSpots,
  computeChemistry,
  formationLayout,
  formationLinks,
  linkBetween,
  type ChemistryPlayer,
  type ChemistryProfile,
} from "@champion/shared";

const career = (nat: string, ...stints: [string, number, number][]): ChemistryProfile => ({
  nationalities: [nat],
  clubs: stints.map(([club, from, to]) => ({
    league: "ITA",
    clubSlug: club,
    seasons: Array.from({ length: to - from + 1 }, (_, i) => from + i),
  })),
});

const baresi = career("ITA", ["milan", 1977, 1996]);
const maldini = career("ITA", ["milan", 1984, 2008]);
const pirlo = career("ITA", ["inter-milan", 1998, 2000], ["milan", 2001, 2010], ["juventus", 2011, 2014]);
const zidane = career("FRA", ["juventus", 1996, 2000]);
const henry = { nationalities: ["FRA"], clubs: [{ league: "ENG" as const, clubSlug: "arsenal", seasons: [1999, 2000, 2001] }] };

describe("chemistry links", () => {
  it("ranks what two players share", () => {
    const legends = linkBetween(baresi, maldini);
    assert.equal(legends.kind, "legends");
    assert.equal(legends.seasonsTogether?.length, 13);
    assert.equal(linkBetween(maldini, pirlo).kind, "legends"); // 2001–2008 at Milan
    assert.equal(linkBetween(baresi, pirlo).kind, "club"); // both Milan, never together
    assert.equal(linkBetween(zidane, henry).kind, "compatriots-era");
    assert.equal(linkBetween(zidane, career("FRA", ["juventus", 1960, 1962])).kind, "club");
    assert.equal(linkBetween(henry, career("FRA", ["x", 1965, 1968])).kind, "compatriots");
    assert.equal(linkBetween(zidane, career("GER", ["roma", 1999, 2001])).kind, "league-era");
    assert.equal(linkBetween(henry, career("GER", ["roma", 1970, 1971])).kind, "none");
    assert.equal(linkBetween(null, maldini).value, 0);
  });

  it("links neighbouring spots of a formation", () => {
    const spots = formationLayout("4-3-3");
    const links = formationLinks("4-3-3").map(([a, b]) => `${spots[a].code}-${spots[b].code}`);
    assert.ok(links.includes("GK-CB"));
    assert.ok(links.includes("LB-CB"));
    assert.ok(links.includes("LW-CF"));
    assert.ok(!links.includes("GK-CF"));
  });
});

describe("team chemistry", () => {
  const player = (id: string, positions: string[], chemistry: ChemistryProfile): ChemistryPlayer => ({
    id,
    name: id,
    position: positions[0] === "GK" ? "GK" : ["CB", "LB", "RB"].includes(positions[0]) ? "DF" : "MF",
    positions,
    chemistry,
  });

  it("scores players 0–3 and grows as the XI fills", () => {
    // 4-3-3: 0 GK, 1 LB, 2 CB, 3 CB, 4 RB, 5-7 CM, 8 LW, 9 CF, 10 RW
    const lineup: (ChemistryPlayer | null)[] = Array(11).fill(null);
    lineup[2] = player("baresi", ["CB"], baresi);
    lineup[1] = player("maldini", ["LB", "CB"], maldini);
    const r = computeChemistry("4-3-3", lineup);
    assert.equal(r.links.length, 1);
    assert.equal(r.links[0].kind, "legends");
    assert.deepEqual([r.players[1], r.players[2]], [3, 3]);
    assert.equal(r.team, Math.round((6 / 33) * 90));
    assert.ok(r.strengthFactor > 0.92 && r.strengthFactor < 1);
  });

  it("previews the best open spot for a candidate", () => {
    const lineup: (ChemistryPlayer | null)[] = Array(11).fill(null);
    lineup[2] = player("baresi", ["CB"], baresi);
    const preview = chemistryPreview("4-3-3", lineup, player("maldini", ["LB", "CB"], maldini));
    assert.equal(preview.bySpot[0], null); // can't keep goal
    assert.ok(preview.best);
    assert.ok(preview.best!.gain > 0);
    assert.ok([1, 3].includes(preview.best!.spot)); // next to Baresi
  });

  it("gives the dynasty bonus for three players of one club", () => {
    const lineup: (ChemistryPlayer | null)[] = Array(11).fill(null);
    lineup[2] = player("baresi", ["CB"], baresi);
    lineup[1] = player("maldini", ["LB"], maldini);
    lineup[6] = player("pirlo", ["CM"], pirlo);
    assert.ok(computeChemistry("4-3-3", lineup).bonuses.some((b) => b.id === "dynasty"));
  });
});

describe("swaps", () => {
  const player = (id: string, positions: string[], chemistry: ChemistryProfile): ChemistryPlayer => ({
    id,
    name: id,
    position: positions[0] === "GK" ? "GK" : "DF",
    positions,
    chemistry,
  });

  it("swaps outfield players, never the keeper, and penalises out of position", () => {
    const lineup: (ChemistryPlayer | null)[] = Array(11).fill(null);
    lineup[0] = player("keeper", ["GK"], career("ITA", ["milan", 1990, 1995]));
    lineup[1] = player("maldini", ["LB"], maldini);
    lineup[2] = player("baresi", ["CB"], baresi);
    assert.equal(swapSpots("4-3-3", lineup, 0, 2), null);
    assert.equal(swapSpots("4-3-3", lineup, 2, 0), null);
    assert.equal(swapSpots("4-3-3", lineup, 5, 2), null); // nobody on 5

    const swapped = swapSpots("4-3-3", lineup, 1, 2)!;
    assert.equal(swapped[1]!.id, "baresi");
    assert.equal(swapped[2]!.id, "maldini");
    const before = computeChemistry("4-3-3", lineup);
    const after = computeChemistry("4-3-3", swapped);
    assert.deepEqual([after.players[1], after.players[2]], [-1, -1]); // both out of position
    assert.ok(after.team < before.team);

    assert.equal(swapSpots("4-3-3", lineup, 2, 3), null); // spot 3 is empty: no swap
    lineup[3] = player("costacurta", ["CB"], career("ITA", ["milan", 1986, 2006]));
    const centreBacks = swapSpots("4-3-3", lineup, 2, 3)!; // CB ↔ CB: both still in position
    assert.deepEqual([centreBacks[2]!.id, centreBacks[3]!.id], ["costacurta", "baresi"]);
    assert.ok(computeChemistry("4-3-3", centreBacks).players.every((p) => p === null || p >= 0));
  });
});

describe("squad summary", () => {
  it("adds up rating, chemistry and partnerships", async () => {
    const { squadSummary, linkLabel } = await import("@champion/shared");
    const lineup: (ChemistryPlayer & { rating?: number } | null)[] = Array(11).fill(null);
    lineup[1] = { id: "m", name: "Maldini", position: "DF", positions: ["LB"], chemistry: maldini, rating: 90 };
    lineup[2] = { id: "b", name: "Baresi", position: "DF", positions: ["CB"], chemistry: baresi, rating: 80 };
    const s = squadSummary("4-3-3", lineup);
    assert.equal(s.rating, 85);
    assert.equal(s.lines.DF, 85);
    assert.equal(s.lines.FW, null);
    assert.equal(s.partnerships.length, 1);
    assert.equal(linkLabel(s.partnerships[0]), "13 seasons together at Milan (1984–97)");
    assert.equal(s.linkCounts.legends, 1);
    assert.ok(s.overall < s.rating); // low chemistry with 2 of 11 placed
  });
});
