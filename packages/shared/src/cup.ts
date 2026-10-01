import type { League } from './leagues';
import {
  expectedGoals,
  lineStrengths,
  matchEvents,
  pickScorer,
  simulateMatch,
  type MatchEvent,
  type MatchPlayer,
  type MatchResult,
  type MatchSide,
} from './match';
import { simulateSeason, standingsAfter, type Scorer, type SeasonResult, type SeasonTeam } from './season';

/**
 * Champions League: 32 teams, 8 groups of 4 (home and away), then two-legged knockout rounds
 * (extra time and penalties in the second leg when the aggregate is level) and a one-off final on
 * neutral ground. Every match is simulated with the match engine.
 */

export type CupTeam = SeasonTeam & {
  /** Home league of the club; your XI has none (so it can meet anyone in its group). */
  league: League | null;
  elo?: number | null;
};

export type CupMatch = {
  stage: string;
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  neutral?: boolean;
  /** Goals scored in extra time (included in homeGoals / awayGoals). */
  extraTime?: { home: number; away: number };
  penalties?: { home: number; away: number };
  /** The 90 minutes in full (goals, cards by minute) – only for the matches of `detailFor`. */
  detail?: { result: MatchResult; events: MatchEvent[] };
};

export type CupTie = {
  /** `a` hosts the first leg. */
  a: string;
  b: string;
  legs: CupMatch[];
  aggA: number;
  aggB: number;
  winner: string;
};

export type CupRound = { name: string; ties: CupTie[] };

export type CupGroup = { name: string; teams: string[]; result: SeasonResult };

export type CupResult = {
  /** Seeding pots, strongest first (4 × 8 team ids). */
  pots: string[][];
  groups: CupGroup[];
  rounds: CupRound[];
  championId: string;
  /** Every match in order, for "your path". */
  matches: CupMatch[];
  scorers: Scorer[];
};

export const CUP_ROUNDS = ['Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'] as const;
const GROUP_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const PENALTY_SCORED = 0.76;

/** Team strength for seeding: mean of the four line ratings, times chemistry. */
export function teamStrength(team: MatchSide): number {
  const l = lineStrengths(team.xi, team.factor ?? 1);
  return (l.GK + l.DF + l.MF + l.FW) / 4;
}

function shuffle<T>(list: readonly T[], random: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function poissonSample(lambda: number, random: () => number): number {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = random();
  while (p > limit) {
    k++;
    p *= random();
  }
  return k;
}

/** Draw the 8 groups: one team per pot, no two clubs from the same league where possible. */
function drawGroups(pots: CupTeam[][], random: () => number): CupTeam[][] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const groups: CupTeam[][] = GROUP_NAMES.map(() => []);
    let ok = true;
    for (const pot of pots) {
      for (const team of shuffle(pot, random)) {
        const size = groups.reduce((m, g) => Math.min(m, g.length), 9);
        const open = groups.filter((g) => g.length === size);
        const clean = open.filter((g) => !team.league || !g.some((t) => t.league === team.league));
        if (!clean.length && attempt < 150) {
          ok = false;
          break;
        }
        const pick = (clean.length ? clean : open)[Math.floor(random() * (clean.length || open.length))]!;
        pick.push(team);
      }
      if (!ok) break;
    }
    if (ok) return groups;
  }
  throw new Error('Group draw failed');
}

type Pairing = [CupTeam, CupTeam];

/** Round of 16: group winners against runners-up of another group (and another league if possible). */
function drawRoundOf16(winners: CupTeam[], runnersUp: CupTeam[], random: () => number): Pairing[] {
  for (let attempt = 0; attempt < 300; attempt++) {
    const left = new Set(runnersUp.map((_, i) => i));
    const pairs: Pairing[] = [];
    let ok = true;
    for (const w of shuffle(
      winners.map((t, g) => ({ t, g })),
      random,
    )) {
      const options = [...left].filter((r) => r !== w.g);
      const clean = options.filter((r) => !w.t.league || runnersUp[r]!.league !== w.t.league);
      const pool = clean.length || attempt > 200 ? (clean.length ? clean : options) : [];
      if (!pool.length) {
        ok = false;
        break;
      }
      const r = pool[Math.floor(random() * pool.length)]!;
      left.delete(r);
      // The runner-up hosts the first leg, the group winner the second.
      pairs.push([runnersUp[r]!, w.t]);
    }
    if (ok) return pairs;
  }
  return winners.map((w, i) => [runnersUp[i]!, w]);
}

function penalties(random: () => number): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (let k = 0; k < 5; k++) {
    home += random() < PENALTY_SCORED ? 1 : 0;
    away += random() < PENALTY_SCORED ? 1 : 0;
  }
  while (home === away) {
    home += random() < PENALTY_SCORED ? 1 : 0;
    away += random() < PENALTY_SCORED ? 1 : 0;
  }
  return { home, away };
}

type Sink = { matches: CupMatch[]; goals: { teamId: string; scorer: string }[]; detailFor?: string };

/** Plays one match; adds extra time (and penalties) when `decide` says the tie is still level. */
function play(
  stage: string,
  home: CupTeam,
  away: CupTeam,
  random: () => number,
  sink: Sink,
  opts: { neutral?: boolean; decide?: (homeGoals: number, awayGoals: number) => boolean } = {},
): CupMatch {
  const r = simulateMatch(home, away, random, { neutral: opts.neutral });
  const match: CupMatch = {
    stage,
    home: home.id,
    away: away.id,
    homeGoals: r.homeGoals,
    awayGoals: r.awayGoals,
    neutral: opts.neutral,
  };
  if (sink.detailFor !== undefined && (home.id === sink.detailFor || away.id === sink.detailFor)) {
    match.detail = { result: r, events: matchEvents(home, away, r, random) };
  }
  for (const g of r.goals) sink.goals.push({ teamId: g.side === 'home' ? home.id : away.id, scorer: g.scorer });
  if (opts.decide?.(match.homeGoals, match.awayGoals)) {
    // Extra time: 30 minutes, a third of the 90-minute expected goals.
    const h = lineStrengths(home.xi, home.factor ?? 1);
    const a = lineStrengths(away.xi, away.factor ?? 1);
    const et = {
      home: poissonSample(expectedGoals(h, a, !opts.neutral) / 3, random),
      away: poissonSample(expectedGoals(a, h, false) / 3, random),
    };
    for (let i = 0; i < et.home; i++) sink.goals.push({ teamId: home.id, scorer: pickScorer(home.xi, random) });
    for (let i = 0; i < et.away; i++) sink.goals.push({ teamId: away.id, scorer: pickScorer(away.xi, random) });
    match.extraTime = et;
    match.homeGoals += et.home;
    match.awayGoals += et.away;
    if (opts.decide(match.homeGoals, match.awayGoals)) match.penalties = penalties(random);
  }
  sink.matches.push(match);
  return match;
}

function twoLegs(stage: string, a: CupTeam, b: CupTeam, random: () => number, sink: Sink): CupTie {
  const first = play(`${stage} · 1st leg`, a, b, random, sink);
  // Second leg at b: level on aggregate after 90 minutes → extra time, then penalties.
  const second = play(`${stage} · 2nd leg`, b, a, random, sink, {
    decide: (bGoals, aGoals) => first.homeGoals + aGoals === first.awayGoals + bGoals,
  });
  const aggA = first.homeGoals + second.awayGoals;
  const aggB = first.awayGoals + second.homeGoals;
  const winner =
    aggA !== aggB ? (aggA > aggB ? a.id : b.id) : second.penalties!.home > second.penalties!.away ? b.id : a.id;
  return { a: a.id, b: b.id, legs: [first, second], aggA, aggB, winner };
}

export function simulateCup(
  teams: readonly CupTeam[],
  random: () => number = Math.random,
  /** Keep the whole match (events included) for this team's matches, to watch them one by one. */
  options: { detailFor?: string } = {},
): CupResult {
  if (teams.length !== 32) throw new Error(`A Champions League needs 32 teams, got ${teams.length}`);
  const byId = new Map(teams.map((t) => [t.id, t]));
  const sink: Sink = { matches: [], goals: [], detailFor: options.detailFor };

  // Seeding by strength into 4 pots of 8, then the group draw.
  const seeded = [...teams].sort((x, y) => teamStrength(y) - teamStrength(x));
  const pots = [0, 1, 2, 3].map((p) => seeded.slice(p * 8, p * 8 + 8));
  const drawn = drawGroups(pots, random);

  const groups: CupGroup[] = drawn.map((g, i) => {
    const result = simulateSeason(g, 3, random, { detailFor: options.detailFor });
    for (const f of result.fixtures) {
      sink.matches.push({
        stage: `Group ${GROUP_NAMES[i]} · MD${f.round}`,
        home: f.home,
        away: f.away,
        homeGoals: f.homeGoals,
        awayGoals: f.awayGoals,
        ...(f.detail ? { detail: f.detail } : {}),
      });
    }
    return { name: GROUP_NAMES[i]!, teams: g.map((t) => t.id), result };
  });
  for (const g of groups)
    for (const s of g.result.scorers)
      for (let k = 0; k < s.goals; k++) sink.goals.push({ teamId: s.teamId, scorer: s.name });

  const winners = groups.map((g) => byId.get(g.result.table[0]!.id)!);
  const runnersUp = groups.map((g) => byId.get(g.result.table[1]!.id)!);

  const rounds: CupRound[] = [];
  let pairs = drawRoundOf16(winners, runnersUp, random);
  for (const name of CUP_ROUNDS.slice(0, 3)) {
    const ties = pairs.map(([a, b]) => twoLegs(name, a, b, random, sink));
    rounds.push({ name, ties });
    const through = shuffle(
      ties.map((t) => byId.get(t.winner)!),
      random,
    );
    pairs = Array.from({ length: through.length / 2 }, (_, i) => [through[2 * i]!, through[2 * i + 1]!] as Pairing);
  }

  const [fa, fb] = pairs[0]!;
  const final = play('Final', fa, fb, random, sink, { neutral: true, decide: (h, a) => h === a });
  const finalWinner =
    final.homeGoals !== final.awayGoals
      ? final.homeGoals > final.awayGoals
        ? fa.id
        : fb.id
      : final.penalties!.home > final.penalties!.away
        ? fa.id
        : fb.id;
  rounds.push({
    name: 'Final',
    ties: [{ a: fa.id, b: fb.id, legs: [final], aggA: final.homeGoals, aggB: final.awayGoals, winner: finalWinner }],
  });

  const tally = new Map<string, Scorer>();
  for (const g of sink.goals) {
    const key = `${g.teamId}|${g.scorer}`;
    const s = tally.get(key) ?? { teamId: g.teamId, name: g.scorer, goals: 0 };
    s.goals++;
    tally.set(key, s);
  }

  return {
    pots: pots.map((p) => p.map((t) => t.id)),
    groups,
    rounds,
    championId: finalWinner,
    matches: sink.matches,
    scorers: [...tally.values()].sort((x, y) => y.goals - x.goals || x.name.localeCompare(y.name)),
  };
}

// ---- Playing the cup match by match: what is known after some of a team's matches.

const GROUP_MATCHDAYS = 6;
const involves = (m: CupMatch, teamId: string) => m.home === teamId || m.away === teamId;

export type CupProgress = {
  /** The team's matches, in order (6 group matches, then knockout legs until it goes out). */
  matches: CupMatch[];
  shown: number;
  done: boolean;
  /** The next match to play, null when done. */
  next: CupMatch | null;
  /** The cup as far as it has been played: tables after the shown matchday, the drawn round. */
  view: CupResult;
};

/**
 * The cup after `shown` of `teamId`'s matches. Everything was simulated at kick-off; this only
 * decides how much of it is visible: every group after the same matchday, a knockout round once
 * the group stage is over (its ties with the legs played so far), nothing of the rounds beyond.
 * With all matches shown the view is the whole result.
 */
export function cupProgress(result: CupResult, teamId: string, shown: number): CupProgress {
  const matches = result.matches.filter((m) => involves(m, teamId));
  const n = Math.max(0, Math.min(shown, matches.length));
  if (n >= matches.length) return { matches, shown: matches.length, done: true, next: null, view: result };

  const played = matches.slice(0, n);
  const matchday = played.filter((m) => m.stage.startsWith('Group')).length;
  const groups = result.groups.map((g) => ({
    ...g,
    result: {
      ...g.result,
      table: standingsAfter(g.result.table, g.result.fixtures, matchday, g.result.pointsForWin),
      fixtures: g.result.fixtures.filter((f) => f.round <= matchday),
      scorers: [],
    },
  }));

  const rounds: CupRound[] = [];
  if (matchday >= GROUP_MATCHDAYS) {
    for (const round of result.rounds) {
      const legs = played.filter((m) => m.stage.startsWith(round.name)).length;
      const mine = round.ties.find((t) => t.a === teamId || t.b === teamId);
      if (!mine) break;
      if (legs >= mine.legs.length) {
        rounds.push(round);
        continue;
      }
      // The round being played: every tie with the legs played so far, no winner yet.
      rounds.push({
        name: round.name,
        ties: round.ties.map((t) => {
          const first = legs > 0 ? t.legs[0] : undefined;
          return { ...t, legs: t.legs.slice(0, legs), aggA: first?.homeGoals ?? 0, aggB: first?.awayGoals ?? 0, winner: '' };
        }),
      });
      break;
    }
  }
  return {
    matches,
    shown: n,
    done: false,
    next: matches[n]!,
    view: { ...result, groups, rounds, championId: '', matches: played, scorers: [] },
  };
}

/** GET /api/cl-field?season=2008 – the 31 strongest clubs of the top five leagues that season (by Elo). */
export type CupFieldResponse = {
  season: number;
  clubs: {
    league: League;
    clubSlug: string;
    club: string;
    elo: number | null;
    xi: (MatchPlayer & { positions: string[] })[];
  }[];
};
