import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { expected, runElo } from "../src/results/elo-engine";
import { parseCsv, parseEsdChamps, parseEsdLeague } from "../src/results/parse-esd";
import { parseOpenfootball, parseScore } from "../src/results/parse-openfootball";
import type { Game } from "../src/results/resolve";
import { resolveTeams } from "../src/results/resolve";

describe("engsoccerdata csv", () => {
  it("reads quoted fields and keeps only the top flight", () => {
    const csv = `"Date","Season","home","visitor","FT","hgoal","vgoal","division","tier"
"1975-08-16",1975,"Arsenal","Burnley","0-0",0,0,"1",1
"1975-08-16",1975,"Bristol City","Oldham","2-1",2,1,"2",2
`;
    assert.equal(parseCsv(csv).length, 2);
    const m = parseEsdLeague(csv, "ENG");
    assert.equal(m.length, 1);
    assert.deepEqual(m[0], {
      date: "1975-08-16", season: 1975, comp: "ENG", home: "Arsenal", away: "Burnley",
      homeCountry: "ENG", awayCountry: "ENG", homeGoals: 0, awayGoals: 0, neutral: false,
    });
  });

  it("takes the extra-time score from champs.csv and makes the final neutral", () => {
    const csv = `Date,Season,round,leg,home,visitor,FT,HT,aet,pens,hgoal,vgoal,FTagg_home,FTagg_visitor,aethgoal,aetvgoal,tothgoal,totvgoal,totagg_home,totagg_visitor,tiewinner,hcountry,vcountry
1968-05-29,1967,"final",NA,"Manchester United","Benfica","1-1","0-0","aet",NA,1,1,1,1,3,0,4,1,4,1,"Manchester United","ENG","POR"
`;
    const [m] = parseEsdChamps(csv, 2015);
    assert.equal(m.homeGoals, 4);
    assert.equal(m.awayGoals, 1);
    assert.equal(m.neutral, true);
    assert.equal(m.awayCountry, "POR");
  });
});

describe("openfootball txt", () => {
  it("reads both match-line styles", () => {
    const a = parseOpenfootball(
      `= English Premier League 2022/23
# Matches 380
Fri Aug 5 2022
  20:00  Crystal Palace FC        0-2 (0-1)  Arsenal FC
Sat Aug 6
         Fulham FC                2-2 (1-0)  Liverpool FC
`,
      2022,
      "ENG",
    );
    assert.deepEqual(a.map((m) => [m.date, m.home, m.away, m.homeGoals, m.awayGoals]), [
      ["2022-08-05", "Crystal Palace FC", "Arsenal FC", 0, 2],
      ["2022-08-06", "Fulham FC", "Liverpool FC", 2, 2],
    ]);

    const b = parseOpenfootball(
      `▪ Matchday 1
  Fri Aug 21 2026
    20:00  Arsenal FC              v Coventry City FC         3-0 (2-0)
    20:00  Everton FC              v Chelsea FC
`,
      2026,
      "ENG",
    );
    assert.equal(b.length, 1, "unplayed fixture skipped");
    assert.equal(b[0].away, "Coventry City FC");
  });

  it("handles cup rounds: country codes, extra time, penalties, neutral final, new year", () => {
    const m = parseOpenfootball(
      `▪ Finals, Round of 16
  Tue Dec 10 2019
    21:00  Real Madrid (ESP)       v Bayern München (GER)     1-3 pen. 2-1 a.e.t. (2-1, 2-1)
  Wed Feb 19
    21:00  Chelsea FC (ENG)        v SSC Napoli (ITA)         4-1 a.e.t. (3-1, 1-0)
           RB Leipzig (GER)        v Spartak Moskva (RUS)     [cancelled]
▪ Finals, Final
  Sat Jun 1
    21:00  Tottenham Hotspur (ENG) v Liverpool FC (ENG)       0-2 (0-1)
`,
      2019,
      "EUR",
    );
    assert.deepEqual(m.map((x) => [x.date, x.home, x.homeCountry, x.homeGoals, x.awayGoals, x.neutral]), [
      ["2019-12-10", "Real Madrid", "ESP", 2, 1, false],
      ["2020-02-19", "Chelsea FC", "ENG", 4, 1, false],
      ["2020-06-01", "Tottenham Hotspur", "ENG", 0, 2, true],
    ]);
    assert.deepEqual(parseScore("4-3 pen. 1-1 a.e.t. (1-1, 0-0)"), [1, 1]);
  });
});

const game = (date: string, season: number, home: string, away: string, hg: number, ag: number, comp: Game["comp"] = "ENG"): Game => ({
  date, season, comp, home, away, homeCountry: comp === "EUR" ? "ENG" : comp, awayCountry: comp === "EUR" ? "ITA" : comp,
  homeGoals: hg, awayGoals: ag, neutral: false,
});

describe("elo engine", () => {
  it("is zero-sum and rewards the winner", () => {
    const r = runElo([game("1975-08-16", 1975, "A", "B", 3, 0), game("1975-08-23", 1975, "B", "A", 1, 1)]);
    const a = r.current.get("A")!;
    const b = r.current.get("B")!;
    assert.ok(a > 1500 && b < 1500);
    assert.ok(Math.abs(a + b - 3000) < 1e-9);
    assert.equal(r.teamSeasons.get("ENG 1975 A")!.games, 2);
    assert.ok(expected(1600, 1500, 0) > 0.6);
  });

  it("gives a promoted club the rating of the club it replaces", () => {
    const r = runElo([
      game("1975-08-16", 1975, "A", "B", 3, 0),
      game("1976-08-14", 1976, "A", "C", 1, 0), // B relegated, C promoted
    ]);
    const relegated = r.teamSeasons.get("ENG 1975 B")!.end;
    assert.equal(r.teamSeasons.get("ENG 1976 C")!.mean, relegated);
  });

  it("lets a league gain strength only through European matches", () => {
    const r = runElo([
      game("1975-08-16", 1975, "A", "B", 1, 1),
      game("1975-08-16", 1975, "X", "Y", 1, 1, "ITA"),
      game("1975-09-17", 1975, "A", "X", 4, 0, "EUR"),
    ]);
    const eng = r.current.get("A")! + r.current.get("B")!;
    const ita = r.current.get("X")! + r.current.get("Y")!;
    assert.ok(eng > ita);
    assert.ok(Math.abs(eng + ita - 6000) < 1e-9);
  });
});

describe("elo from a final table", () => {
  it("moves clubs by points against expectation and keeps the pool closed", () => {
    const r = runElo(
      [game("1993-08-14", 1993, "A", "B", 1, 1), game("1993-08-14", 1993, "C", "D", 1, 1)],
      [
        {
          league: "ENG",
          season: 1994,
          date: "1995-05-31",
          rows: [
            { key: "A", won: 6, drawn: 0, lost: 0 },
            { key: "B", won: 2, drawn: 2, lost: 2 },
            { key: "C", won: 1, drawn: 2, lost: 3 },
            { key: "D", won: 0, drawn: 2, lost: 4 },
          ],
        },
      ],
    );
    const a = r.teamSeasons.get("ENG 1994 A")!;
    const d = r.teamSeasons.get("ENG 1994 D")!;
    assert.equal(a.fromTable, true);
    assert.ok(a.end > 1500 && d.end < 1500);
    assert.ok(a.mean > 1500 && a.mean < a.end, "season mean is halfway");
    const total = ["A", "B", "C", "D"].reduce((s, k) => s + r.current.get(k)!, 0);
    assert.ok(Math.abs(total - 6000) < 1e-6);
  });
});

describe("team resolution", () => {
  it("links result names to Transfermarkt ids and keeps the id in seasons without a map", () => {
    const raw = [
      { ...game("1959-08-22", 1959, "Arsenal", "Burnley", 1, 0) },
      { ...game("1960-08-20", 1960, "Arsenal", "Burnley", 2, 0) },
    ];
    const map = {
      ENG: {
        "1960": {
          arsenal: { tmId: 11, tmSlug: "fc-arsenal", tmName: "Arsenal FC", score: 1, how: "name" },
          burnley: { tmId: 1132, tmSlug: "fc-burnley", tmName: "Burnley FC", score: 1, how: "name" },
        },
      },
    };
    const r = resolveTeams(raw, map, {});
    assert.deepEqual(r.games.map((g) => [g.season, g.home, g.away]), [
      [1959, "tm:11", "tm:1132"],
      [1960, "tm:11", "tm:1132"],
    ]);
  });
});

describe("player rating", () => {
  it("rates the best season 100 and a regular around the median", async () => {
    const { ratePlayers, playerKey } = await import("../src/rating/model");
    const clubs = [0, 1, 2, 3, 4].map((i) => ({
      league: "ENG" as const, season: 1990, clubSlug: `c${i}`, elo: 1500 + i * 50,
      table: { position: 5 - i, played: 38, won: 10 + i, drawn: 10, lost: 18 - i, goalsFor: 40 + i * 5, goalsAgainst: 50 - i * 5, points: 40 + i * 3 },
    }));
    const players = clubs.flatMap((c, i) =>
      [0, 1].map((j) => ({
        league: "ENG" as const, season: 1990, clubSlug: c.clubSlug, nameSlug: `fw${i}${j}`, position: "FW" as const,
        appearances: 30, goals: 5 + i * 4 + j, assists: 2, minutes: 2700, pointsPerGame: 1.2 + i * 0.1,
        cleanSheets: null, goalsConceded: null, redCards: 0, secondYellowCards: 0, tmPlayerId: i * 10 + j,
      })),
    );
    const r = ratePlayers({ clubs, players });
    const all = players.map((p) => r.get(playerKey(p))!.rating);
    assert.equal(Math.max(...all), 100);
    assert.ok(r.get(playerKey(players[0]))!.rating < r.get(playerKey(players[9]))!.rating);
  });
});
