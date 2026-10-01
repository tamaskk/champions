import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LEGENDS,
  PlayError,
  YOUR_ID,
  legendClub,
  packLegends,
  packTournamentData,
  seededRandom,
  simulateTournament,
  type League,
  type OfflineClubSeason,
  type OfflineLeagueSeasons,
} from "../src/index";

import { side } from "./helpers";

const club = (i: number, rating: number): OfflineClubSeason => ({
  clubSlug: `club-${i}`,
  club: `Club ${i}`,
  elo: 1900 - i * 20,
  table: { position: i + 1, played: 10, won: 5, drawn: 2, lost: 3, goalsFor: 15, goalsAgainst: 10, points: 17 },
  xi: side(`Club ${i}`, rating).xi.map((p) => ({ ...p, positions: [] })),
});

// A tiny pack: 8 clubs per league in 1990, and one club without a table line.
const packs = new Map<League, OfflineLeagueSeasons>(
  (["ENG", "ESP", "ITA", "GER", "FRA"] as const).map((league) => [
    league,
    { league, seasons: { "1990": [...Array.from({ length: 8 }, (_, i) => club(i, 85 - i * 3)), { ...club(8, 60), table: null }] } },
  ]),
);
const data = packTournamentData(async (league) => packs.get(league) ?? null);

describe("offline pack as tournament data", () => {
  it("table: only clubs with a table line, top to bottom", async () => {
    const rows = await data.leagueTable("ENG", 1990);
    assert.deepEqual(rows.map((r) => r.position), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual(await data.leagueTable("ENG", 1991), []);
  });

  it("opponent: any club season, by slug", async () => {
    assert.equal((await data.opponentXI("ITA", 1990, "club-8"))?.club, "Club 8");
    assert.equal(await data.opponentXI("ITA", 1990, "nobody"), null);
  });

  it("cup field: the 31 strongest by Elo across the five leagues", async () => {
    const field = await data.cupField(1990);
    assert.equal(field?.clubs.length, 31);
    assert.ok(field!.clubs.every((c, i, all) => i === 0 || (all[i - 1]!.elo ?? 0) >= (c.elo ?? 0)));
    assert.equal(await data.cupField(1991), null);
  });

  it("a legend is found by its slug pattern in its league season", () => {
    const legend = LEGENDS[0]!;
    const candidates = [
      { league: legend.league, season: legend.season, clubSlug: "definitely-not-it-xyz", elo: 2000 },
      { league: legend.league, season: legend.season + 1, clubSlug: "wrong-season", elo: 2000 },
    ];
    assert.equal(legendClub(legend, candidates), null);
  });

  it("no legend is playable from a pack without their seasons", async () => {
    assert.deepEqual(await packLegends(data), []);
  });
});

describe("simulateTournament (the code the server and the offline app share)", () => {
  const you = side("You", 80);

  it("match: plays the chosen club season", async () => {
    const r = await simulateTournament({ mode: "match", league: "ENG", season: 1990, clubSlug: "club-0" }, you, data, seededRandom("m"));
    assert.equal(r.mode, "match");
    assert.ok(r.mode === "match" && r.played.opponentName === "Club 0");
    assert.equal(r.report.title, "vs Club 0 1990/91");
  });

  it("league: you replace the club that finished last", async () => {
    const r = await simulateTournament({ mode: "league", league: "ENG", season: 1990 }, you, data, seededRandom("l"));
    assert.ok(r.mode === "league");
    assert.equal(r.replaced, "Club 7");
    assert.equal(r.result.table.length, 8);
    assert.ok(r.result.table.some((row) => row.id === YOUR_ID));
    assert.ok(!r.result.table.some((row) => row.id === "club-7"));
  });

  it("cup: 32 teams with you in the field", async () => {
    const r = await simulateTournament({ mode: "cup", season: 1990 }, you, data, seededRandom("c"));
    assert.ok(r.mode === "cup");
    assert.equal(r.teams.length, 32);
    assert.equal(r.teams[0]!.id, YOUR_ID);
  });

  it("the same seed gives the same tournament", async () => {
    const a = await simulateTournament({ mode: "league", league: "GER", season: 1990 }, you, data, seededRandom("same"));
    const b = await simulateTournament({ mode: "league", league: "GER", season: 1990 }, you, data, seededRandom("same"));
    assert.deepEqual(a, b);
  });

  it("missing data is a PlayError the player can read", async () => {
    await assert.rejects(simulateTournament({ mode: "match", league: "ENG", season: 1990, clubSlug: "nobody" }, you, data), PlayError);
    await assert.rejects(simulateTournament({ mode: "league", league: "ENG", season: 1950 }, you, data), PlayError);
    await assert.rejects(simulateTournament({ mode: "cup", season: 1950 }, you, data), PlayError);
    await assert.rejects(simulateTournament({ mode: "legend", legendId: "nobody" }, you, data), PlayError);
  });
});
