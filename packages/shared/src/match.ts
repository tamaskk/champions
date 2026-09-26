import { computeChemistry, type ChemistryPlayer } from './chemistry';
import { formationRoles, type PlayerRole } from './formation-layout';
import type { League } from './leagues';

/**
 * Match engine. Goals are Poisson: each side's expected goals come from its lines (goalkeeper,
 * defence, midfield, attack – mean player rating) against the other side's lines, fitted on the
 * real top-flight matches since 1960 (see MATCH_MODEL). Every
 * simulation is random: the stronger side wins as often as it did in reality, not always.
 */

/** A player as the engine needs him. */
export type MatchPlayer = {
  name: string;
  position: PlayerRole;
  rating: number | null;
  /** For picking goalscorers: league goals and appearances (season, or summed over a decade). */
  goals?: number | null;
  appearances?: number | null;
  minutes?: number | null;
};

export type Lines = Record<PlayerRole, number>;

/**
 * Poisson regression on 113,775 top-flight league matches 1960–2025 (both sides' likely XI from
 * their real squads and season ratings; fitted 2026-09-26). log(expected goals) = intercept
 * + home + own midfield/attack − opponent goalkeeper/defence (mean line ratings, 0–100).
 * Checks: predicted home wins 48.4 % (real 49.1 %), draws 25.6 % (27.1 %), goals 1.62 / 1.07
 * (same); win chance within ±3 points of reality in every tenth of the matches.
 * Examples at home: 60 v 60 → 48 % win · 75 v 60 → 72 % · 85 v 60 → 85 %.
 */
export const MATCH_MODEL = {
  intercept: -0.5175,
  /** Added for the home side only (≈ ×1.5 goals). */
  home: 0.411,
  /** Effect of the scoring side's lines. */
  own: { GK: 0, DF: 0, MF: 0.01202, FW: 0.01627 } as Lines,
  /** Effect of the conceding side's lines. */
  opp: { GK: -0.0067, DF: -0.01289, MF: 0, FW: 0 } as Lines,
  /** Dixon–Coles: nudges 0–0, 1–0, 0–1 and 1–1 towards reality (more draws). */
  rho: -0.1007,
  maxGoals: 10,
};

const FALLBACK_RATING = 50;
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : FALLBACK_RATING);

/** Mean rating per line. A missing line (no forward…) counts as a weak one. */
export function lineStrengths(xi: readonly MatchPlayer[], factor = 1): Lines {
  const line = (role: PlayerRole) =>
    mean(xi.filter((p) => p.position === role).map((p) => p.rating ?? FALLBACK_RATING));
  return {
    GK: line('GK') * factor,
    DF: line('DF') * factor,
    MF: line('MF') * factor,
    FW: line('FW') * factor,
  };
}

/**
 * A real club season's likely XI: the goalkeeper with most minutes, then the most used outfield
 * players – 4 defenders, 3 midfielders, 2 forwards, and the next most used outfield player.
 */
export function pickStartingXI<T extends MatchPlayer>(squad: readonly T[]): T[] {
  const used = (p: T) => p.minutes ?? (p.appearances ?? 0) * 90;
  const byUse = [...squad].sort((a, b) => used(b) - used(a) || (b.rating ?? 0) - (a.rating ?? 0));
  const take = (role: PlayerRole, n: number) => byUse.filter((p) => p.position === role).slice(0, n);
  const xi = [...take('GK', 1), ...take('DF', 4), ...take('MF', 3), ...take('FW', 2)];
  const rest = byUse.filter((p) => p.position !== 'GK' && !xi.includes(p));
  return [...xi, ...rest].slice(0, 11);
}

/** Expected goals of a side scoring against `opp`. */
export function expectedGoals(own: Lines, opp: Lines, home: boolean): number {
  const m = MATCH_MODEL;
  let x = m.intercept + (home ? m.home : 0);
  for (const role of ['GK', 'DF', 'MF', 'FW'] as PlayerRole[]) x += m.own[role] * own[role] + m.opp[role] * opp[role];
  return Math.exp(x);
}

const poisson = (k: number, lambda: number) => {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
};

/** Probability of every score up to maxGoals, with the Dixon–Coles low-score correction. */
export function scoreProbabilities(lambdaHome: number, lambdaAway: number): number[][] {
  const { rho, maxGoals } = MATCH_MODEL;
  const grid: number[][] = [];
  let total = 0;
  for (let h = 0; h <= maxGoals; h++) {
    grid.push([]);
    for (let a = 0; a <= maxGoals; a++) {
      let p = poisson(h, lambdaHome) * poisson(a, lambdaAway);
      if (h === 0 && a === 0) p *= 1 - lambdaHome * lambdaAway * rho;
      else if (h === 0 && a === 1) p *= 1 + lambdaHome * rho;
      else if (h === 1 && a === 0) p *= 1 + lambdaAway * rho;
      else if (h === 1 && a === 1) p *= 1 - rho;
      grid[h].push(Math.max(0, p));
      total += Math.max(0, p);
    }
  }
  return grid.map((row) => row.map((p) => p / total));
}

/** Win / draw / loss chances from the home side's view. */
export function outcomeChances(lambdaHome: number, lambdaAway: number) {
  const grid = scoreProbabilities(lambdaHome, lambdaAway);
  let win = 0;
  let draw = 0;
  grid.forEach((row, h) => row.forEach((p, a) => (h > a ? (win += p) : h === a ? (draw += p) : null)));
  return { win, draw, loss: 1 - win - draw };
}

export type Goal = { side: 'home' | 'away'; minute: number; scorer: string };

export type MatchSide = {
  name: string;
  xi: MatchPlayer[];
  /** Chemistry multiplier on the ratings (1 = a real, settled team). */
  factor?: number;
  /**
   * Substitutes; a league season rotates them in (see simulateSeason), an empty bench means the XI
   * plays tired when it needs a rest. Real clubs have none (no rotation). Single matches ignore it.
   */
  bench?: MatchPlayer[];
};

export type MatchResult = {
  homeGoals: number;
  awayGoals: number;
  goals: Goal[];
  expected: { home: number; away: number };
  chances: { win: number; draw: number; loss: number };
};

/** Scorer weights: goals per appearance, plus a small chance for anyone by position. */
const BASE_SCORING: Record<PlayerRole, number> = {
  FW: 0.08,
  MF: 0.04,
  DF: 0.015,
  GK: 0,
};

export function pickScorer(xi: readonly MatchPlayer[], random: () => number): string {
  const weights = xi.map((p) => BASE_SCORING[p.position] + (p.appearances ? (p.goals ?? 0) / p.appearances : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < xi.length; i++) {
    r -= weights[i];
    if (r <= 0) return xi[i].name;
  }
  return xi[xi.length - 1]?.name ?? '?';
}

/** Goals come a little more often late in a game. */
function goalMinute(random: () => number) {
  const m = Math.floor(Math.pow(random(), 0.9) * 90) + 1;
  return Math.min(90, m);
}

/** Plays one match. `random` defaults to Math.random (every run is different). */
export function simulateMatch(
  home: MatchSide,
  away: MatchSide,
  random: () => number = Math.random,
  /** neutral: a final on neutral ground, no home advantage for either side. */
  options: { neutral?: boolean } = {},
): MatchResult {
  const h = lineStrengths(home.xi, home.factor ?? 1);
  const a = lineStrengths(away.xi, away.factor ?? 1);
  const lambdaHome = expectedGoals(h, a, !options.neutral);
  const lambdaAway = expectedGoals(a, h, false);

  const grid = scoreProbabilities(lambdaHome, lambdaAway);
  let r = random();
  let homeGoals = 0;
  let awayGoals = 0;
  outer: for (let x = 0; x < grid.length; x++) {
    for (let y = 0; y < grid[x].length; y++) {
      r -= grid[x][y];
      if (r <= 0) {
        homeGoals = x;
        awayGoals = y;
        break outer;
      }
    }
  }

  // One goal per minute at most (two goals in the same minute read like a bug).
  const minutes = new Set<number>();
  const minute = () => {
    for (let tries = 0; tries < 20; tries++) {
      const m = goalMinute(random);
      if (!minutes.has(m)) return (minutes.add(m), m);
    }
    const free = Array.from({ length: 90 }, (_, i) => i + 1).find((m) => !minutes.has(m)) ?? 90;
    return (minutes.add(free), free);
  };
  const goals: Goal[] = [
    ...Array.from({ length: homeGoals }, () => ({
      side: 'home' as const,
      minute: minute(),
      scorer: pickScorer(home.xi, random),
    })),
    ...Array.from({ length: awayGoals }, () => ({
      side: 'away' as const,
      minute: minute(),
      scorer: pickScorer(away.xi, random),
    })),
  ].sort((x, y) => x.minute - y.minute);

  return {
    homeGoals,
    awayGoals,
    goals,
    expected: { home: lambdaHome, away: lambdaAway },
    chances: outcomeChances(lambdaHome, lambdaAway),
  };
}

/** GET /api/opponent?league=GER&season=1972&club=bayern-munich – a real club season's likely XI. */
export type OpponentResponse = {
  league: League;
  season: number;
  clubSlug: string;
  club: string;
  xi: (MatchPlayer & { positions: string[] })[];
};

/** Rating multiplier by how a player fits his spot: main position, other position, out of position. */
export const FIT_FACTORS = { main: 1, other: 0.95, out: 0.8 } as const;

/**
 * Your drafted XI as a match side: every player plays in his spot's line, his rating scaled by
 * how well he fits the spot, and the whole side by chemistry (0.92–1.08; 50 chemistry = a real
 * club's 1.0).
 */
export function sideFromLineup(
  name: string,
  formation: string,
  lineup: readonly ((ChemistryPlayer & Omit<MatchPlayer, 'position' | 'name'>) | null)[],
  /** Substitutes, for league rotation (any position; they play their own role). */
  bench: readonly ((ChemistryPlayer & Omit<MatchPlayer, 'position' | 'name'>) | null)[] = [],
): MatchSide {
  const roles = formationRoles(formation);
  const chemistry = computeChemistry(formation, lineup);
  const xi = lineup.flatMap((p, i) => {
    if (!p) return [];
    const fit = chemistry.fits[i] ?? 'out';
    return [
      {
        name: p.name,
        position: roles[i],
        rating: (p.rating ?? FALLBACK_RATING) * FIT_FACTORS[fit],
        goals: p.goals,
        appearances: p.appearances,
      },
    ];
  });
  const subs = bench.flatMap((p) =>
    p ? [{ name: p.name, position: p.position, rating: p.rating ?? FALLBACK_RATING, goals: p.goals, appearances: p.appearances }] : [],
  );
  return { name, xi, factor: chemistry.strengthFactor, bench: subs };
}

export type MatchEvent = {
  minute: number;
  side: 'home' | 'away';
  type: 'goal' | 'yellow' | 'red';
  player: string;
  /** Goals: who laid it on (null = no assist). */
  assist?: string | null;
  /** Red cards: a second yellow. */
  secondYellow?: boolean;
};

// Per team and match: yellow cards ~1.7, straight reds rare.
const YELLOWS_PER_TEAM = 1.7;
const STRAIGHT_RED = 0.04;
const ASSISTED = 0.75;
const ASSIST_WEIGHT: Record<PlayerRole, number> = { MF: 3, FW: 2, DF: 1, GK: 0.1 };
const CARD_WEIGHT: Record<PlayerRole, number> = { DF: 3, MF: 3, FW: 1.5, GK: 0.3 };

function weightedPick<T>(items: readonly T[], weight: (t: T) => number, random: () => number): T | null {
  const total = items.reduce((s, t) => s + weight(t), 0);
  if (total <= 0) return null;
  let r = random() * total;
  for (const t of items) {
    r -= weight(t);
    if (r <= 0) return t;
  }
  return items[items.length - 1] ?? null;
}

function poissonDraw(lambda: number, random: () => number): number {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = random();
  while (p > limit) {
    k++;
    p *= random();
  }
  return k;
}

/**
 * The story of a simulated match: its goals with assists, plus yellow and red cards (cards are
 * colour only – they don't change the result). Sorted by minute.
 */
export function matchEvents(
  home: MatchSide,
  away: MatchSide,
  result: MatchResult,
  random: () => number = Math.random,
): MatchEvent[] {
  const events: MatchEvent[] = [];
  const sideOf = (side: 'home' | 'away') => (side === 'home' ? home : away);

  for (const g of result.goals) {
    const team = sideOf(g.side).xi.filter((p) => p.name !== g.scorer);
    const assist = random() < ASSISTED ? weightedPick(team, (p) => ASSIST_WEIGHT[p.position], random) : null;
    events.push({ minute: g.minute, side: g.side, type: 'goal', player: g.scorer, assist: assist?.name ?? null });
  }

  for (const side of ['home', 'away'] as const) {
    const xi = sideOf(side).xi;
    const booked = new Set<string>();
    const sentOff = new Set<string>();
    const cards = Array.from({ length: poissonDraw(YELLOWS_PER_TEAM, random) }, () =>
      Math.min(90, Math.floor(Math.pow(random(), 0.7) * 90) + 1),
    ).sort((a, b) => a - b);
    for (const minute of cards) {
      const player = weightedPick(
        xi.filter((p) => !sentOff.has(p.name)),
        (p) => CARD_WEIGHT[p.position],
        random,
      );
      if (!player) continue;
      if (booked.has(player.name)) {
        sentOff.add(player.name);
        events.push({ minute, side, type: 'red', player: player.name, secondYellow: true });
      } else {
        booked.add(player.name);
        events.push({ minute, side, type: 'yellow', player: player.name });
      }
    }
    if (random() < STRAIGHT_RED) {
      const player = weightedPick(
        xi.filter((p) => !sentOff.has(p.name)),
        (p) => CARD_WEIGHT[p.position],
        random,
      );
      if (player) events.push({ minute: Math.floor(random() * 90) + 1, side, type: 'red', player: player.name });
    }
  }

  const order = { goal: 0, yellow: 1, red: 2 };
  return events.sort((a, b) => a.minute - b.minute || order[a.type] - order[b.type]);
}
