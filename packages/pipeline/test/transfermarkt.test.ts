import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { RAW_DIR } from "../src/env";
import { clubSimilarity, matchClubs } from "../src/match-clubs";
import { countryCode } from "../src/transfermarkt/nationality";
import { parseKeepers } from "../src/transfermarkt/parse-keepers";
import { parseLeagueClubs } from "../src/transfermarkt/parse-league";
import { parseLeagueTable } from "../src/transfermarkt/parse-table";
import { parseSquadStats } from "../src/transfermarkt/parse-squad";
import { toSquadPlayers } from "../src/transfermarkt/to-squad";
import { clubSeasonStatsUrl, tmCompetition } from "../src/transfermarkt/urls";

// Saved Transfermarkt pages. Raw scraped HTML is never committed (data/raw is gitignored), so
// these tests skip when the files are missing. Save pages there under these names to run them.
const FIXTURES = path.join(RAW_DIR, "transfermarkt/fixtures");
const fixture = (name: string) => {
  const file = path.join(FIXTURES, `${name}.html`);
  return existsSync(file) ? readFileSync(file, "utf8") : null;
};

describe("urls", () => {
  it("uses EFD1 before the Premier League", () => {
    assert.equal(tmCompetition("ENG", 1991), "EFD1");
    assert.equal(tmCompetition("ENG", 1992), "GB1");
    assert.equal(
      clubSeasonStatsUrl("GER", 1975, 27, "fc-bayern-munchen"),
      "https://www.transfermarkt.com/fc-bayern-munchen/leistungsdaten/verein/27/reldata/L1%261975/plus/1",
    );
  });
});

describe("nationality", () => {
  it("maps Transfermarkt names to squad codes", () => {
    assert.equal(countryCode("Germany"), "GER");
    assert.equal(countryCode("Korea, South"), "KOR");
    assert.equal(countryCode("Cote d'Ivoire"), "CIV");
    assert.equal(countryCode("Bosnia-Herzegovina"), "BIH");
    assert.equal(countryCode("Atlantis"), null);
  });
});

describe("club matching", () => {
  it("scores English names against Transfermarkt names", () => {
    assert.equal(clubSimilarity("Cologne", "1.FC Köln"), 1);
    assert.equal(clubSimilarity("Schalke 04", "FC Schalke 04"), 1);
    assert.ok(clubSimilarity("Sheffield United", "Sheffield Wednesday") < 0.6);
  });

  it("assigns each club once, known ids first, last pair flagged", () => {
    const tm = [
      { tmId: 1, name: "Sheffield Wednesday" },
      { tmId: 2, name: "Sheffield United" },
      { tmId: 3, name: "Stade Reims" },
    ];
    const { matches } = matchClubs(["Sheffield United", "Sheffield Wednesday", "Reims"], tm, {
      oursName: (o) => o,
      theirsName: (t) => t.name,
      theirsId: (t) => t.tmId,
      known: (o) => (o === "Reims" ? { id: 3, how: "alias" as const } : undefined),
    });
    const byName = Object.fromEntries(matches.map((m) => [m.ours, m]));
    assert.equal(byName["Sheffield United"].theirs.tmId, 2);
    assert.equal(byName["Sheffield Wednesday"].theirs.tmId, 1);
    assert.equal(byName.Reims.how, "alias");
  });
});

describe("club matching – leftovers", () => {
  it("does not pair a leftover club with an unrelated name", () => {
    const { matches, unmatchedOurs } = matchClubs(["Liverpool", "Blackburn Rovers"], [{ tmId: 31, name: "Liverpool FC" }, { tmId: 1, name: "Notts County" }], {
      oursName: (o) => o,
      theirsName: (t) => t.name,
      theirsId: (t) => t.tmId,
    });
    assert.equal(matches.length, 1);
    assert.deepEqual(unmatchedOurs, ["Blackburn Rovers"]);
  });

  it("knows old and local club names", () => {
    assert.equal(clubSimilarity("Rennes", "Stade Rennais FC"), 1);
    assert.equal(clubSimilarity("Duisburg", "Meidericher SV"), 1);
  });
});

describe("parse league page", { skip: !fixture("league-L1-1975") && "fixture missing" }, () => {
  it("lists all clubs of Bundesliga 1975/76 with ids", () => {
    const clubs = parseLeagueClubs(fixture("league-L1-1975")!);
    assert.equal(clubs.length, 18);
    assert.deepEqual(
      clubs.find((c) => c.tmId === 27),
      { tmId: 27, tmSlug: "fc-bayern-munchen", name: "Bayern Munich" },
    );
  });
});

describe("parse squad page", { skip: !fixture("bayern-L1-1975") && "fixture missing" }, () => {
  it("reads Bayern 1975/76", () => {
    const page = parseSquadStats(fixture("bayern-L1-1975")!);
    assert.equal(page.selected, "L1&1975");
    assert.equal(page.teamGames, 34);
    assert.deepEqual(page.warnings, []);
    const beckenbauer = page.rows.find((r) => r.name === "Franz Beckenbauer");
    assert.equal(beckenbauer?.role, "DF");
    assert.equal(beckenbauer?.appearances, 34);
    assert.equal(beckenbauer?.goals, 5);
    assert.equal(beckenbauer?.minutes, 3048);
    // Registered but never used: kept, with zero appearances.
    const robl = page.rows.find((r) => r.name === "Hugo Robl");
    assert.equal(robl?.appearances, 0);
    // Team goals add up to Bayern's 72 league goals that season.
    assert.equal(page.rows.reduce((s, r) => s + r.goals, 0), 72);
  });

  it("converts rows into validated squad players", () => {
    const page = parseSquadStats(fixture("bayern-L1-1975")!);
    const target = { league: "GER" as const, season: 1975, clubSlug: "bayern-munich", club: "Bayern Munich" };
    const { players, errors } = toSquadPlayers(page.rows, target, "https://example.test");
    assert.deepEqual(errors, []);
    const muller = players.find((p) => p.name === "Gerd Müller");
    assert.equal(muller?.nationality, "GER");
    assert.equal(muller?.position, "FW");
    assert.equal(muller?.tmPlayerId, 35604);
    const beckenbauer = players.find((p) => p.name === "Franz Beckenbauer");
    assert.equal(beckenbauer?.assists, 4);
    assert.equal(beckenbauer?.yellowCards, 2);
    assert.equal(beckenbauer?.redCards, 0);
    assert.equal(beckenbauer?.subsOff, 1);
    assert.equal(beckenbauer?.detailedPosition, "Sweeper");
    assert.equal(beckenbauer?.pointsPerGame, 1.62);
    assert.deepEqual(beckenbauer?.nationalities, ["GER"]);
  });
});

describe("parse a modern season", { skip: !fixture("bayern-L1-2023") && "fixture missing" }, () => {
  it("reads every stat for Bayern 2023/24", () => {
    const page = parseSquadStats(fixture("bayern-L1-2023")!);
    const kane = page.rows.find((r) => r.name === "Harry Kane");
    assert.deepEqual(
      kane && [kane.appearances, kane.goals, kane.assists, kane.yellowCards, kane.subsOff, kane.minutes],
      [32, 36, 8, 2, 5, 2843],
    );
    const tel = page.rows.find((r) => r.name === "Mathys Tel");
    assert.equal(tel?.subsOn, 24);
    assert.equal(tel?.redCards, 0);
    assert.deepEqual(tel?.nationalities, ["France", "Guadeloupe"]);
  });
});

describe("parse old seasons without assist data", { skip: !fixture("reims-FR1-1961") && "fixture missing" }, () => {
  it("leaves assists null instead of 0", () => {
    const page = parseSquadStats(fixture("reims-FR1-1961")!);
    assert.equal(page.selected, "FR1&1961");
    assert.ok(page.rows.every((r) => r.assists === null && r.subsOn === null));
    assert.equal(page.rows.find((r) => r.name === "Raymond Kopa")?.appearances, 30);
  });
});

describe("parse goalkeeper table", { skip: !fixture("cleansheets-L1-1975") && "fixture missing" }, () => {
  it("reads clean sheets and goals conceded", () => {
    const page = parseKeepers(fixture("cleansheets-L1-1975")!, 1);
    assert.equal(page.rows.length, 25);
    assert.equal(page.hasNextPage, true);
    assert.deepEqual(page.rows[0], {
      tmPlayerId: 84181,
      name: "Wolfgang Kleff",
      matches: 34,
      cleanSheets: 12,
      goalsConceded: 37,
      minutes: 3060,
    });
    // Bayern conceded 50 league goals in 1975/76, all with Maier in goal.
    const maier = page.rows.find((r) => r.name === "Sepp Maier");
    assert.deepEqual(maier && [maier.cleanSheets, maier.goalsConceded], [10, 50]);
  });
});

describe("league table", () => {
  // Minimal copy of Transfermarkt's table markup (1975/76 Bundesliga, top two).
  const html = `<table class="items"><tbody>
    <tr><td class="rechts hauptlink">1</td><td><a href="/x/spielplan/verein/18/saison_id/1975"><img></a></td>
      <td class="hauptlink"><a href="/x/spielplan/verein/18/saison_id/1975" title="Borussia Mönchengladbach">Mönchengladbach</a></td>
      <td>34</td><td>16</td><td>13</td><td>5</td><td>66:37</td><td>29</td><td>45:23</td></tr>
    <tr><td class="rechts hauptlink">2</td><td><a href="/x/spielplan/verein/41/saison_id/1975"><img></a></td>
      <td class="hauptlink"><a href="/x/spielplan/verein/41/saison_id/1975" title="Hamburger SV">Hamburg</a></td>
      <td>34</td><td>17</td><td>7</td><td>10</td><td>59:32</td><td>27</td><td>41:27</td></tr>
  </tbody></table>`;

  it("reads W/D/L, goals and old-style points", () => {
    const { rows } = parseLeagueTable(html);
    assert.deepEqual(rows[0], {
      tmId: 18,
      name: "Borussia Mönchengladbach",
      position: 1,
      played: 34,
      won: 16,
      drawn: 13,
      lost: 5,
      goalsFor: 66,
      goalsAgainst: 37,
      points: 45,
    });
  });

  it("flags a table whose goals don't balance", () => {
    assert.ok(parseLeagueTable(html).problems.some((p) => p.includes("Goals for")));
  });
});

describe("positions api", () => {
  it("reads main + other positions as names and codes", async () => {
    const { parsePositions } = await import("../src/transfermarkt/positions");
    const p = parsePositions({
      id: "411295",
      attributes: {
        position: { id: 14, name: "Centre-Forward", shortName: "CF" },
        firstSidePosition: { id: 11, name: "Left Winger", shortName: "LW" },
        secondSidePosition: { id: 12, name: "Right Winger", shortName: "RW" },
      },
    });
    assert.deepEqual(p, { main: "Centre-Forward", other: ["Left Winger", "Right Winger"], codes: ["CF", "LW", "RW"] });
    assert.deepEqual(parsePositions({ id: "1", attributes: { position: { id: 11, name: "Left Winger", shortName: "LW" } } }).other, []);
  });
});
