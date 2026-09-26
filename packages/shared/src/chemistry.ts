import { formationLayout, formationRoles, positionFit, type PlayerRole, type PositionFit } from './formation-layout';
import type { League } from './leagues';

/**
 * Chemistry: how well the picked players go together. Computed on the device on every move
 * (pure function, a few hundred operations for 11 players) and again on the server.
 *
 * - Links: neighbouring spots of the formation are linked. A link is worth the strongest thing
 *   the two players share (see LINK_VALUES): having played together at a club beats the same club
 *   in another era, beats being compatriots, beats having played in the same league and decade.
 *   Careers count in full, so players picked from different decades still link if they were
 *   team-mates at some point (Baresi from Milan's 80s + Maldini from Milan's 90s).
 * - Player chemistry 0–3: +1 on his main position, +1 if his links average ≥ 1.5, +1 if he has at
 *   least one team-mate link. Out of position (neither his main nor another position, e.g. after a
 *   swap): −1, whatever his links.
 * - Captain: the player flagged `captain` gives each linked neighbour +1 (still capped at 3; an
 *   out-of-position neighbour stays at −1).
 * - Team chemistry 0–100: player points (max 33 for a full XI) scaled to 90, + 5 per bonus
 *   (Dynasty: 3+ players from one club; Golden generation: 4+ compatriots whose careers overlap).
 * - Effect: team strength × (0.92 + 0.16 × chemistry / 100), so −8 % … +8 %.
 */

/** A player's seasons at one club (top-five leagues, seasons he played in). */
export type ClubStint = { league: League; clubSlug: string; seasons: number[] };

/** What chemistry needs to know about a player's career. */
export type ChemistryProfile = {
  /** Nationality codes, primary first. */
  nationalities: string[];
  clubs: ClubStint[];
};

export type ChemistryPlayer = {
  /** Stable id (Transfermarkt player id, or name slug). */
  id: string;
  name: string;
  position: PlayerRole;
  positions?: readonly string[] | null;
  chemistry?: ChemistryProfile | null;
  /** The XI's captain (at most one): his linked neighbours get +1 chemistry. */
  captain?: boolean;
};

export type LinkKind = 'legends' | 'teammates' | 'club' | 'compatriots-era' | 'compatriots' | 'league-era' | 'none';

export const LINK_VALUES: Record<LinkKind, number> = {
  legends: 4,
  teammates: 3,
  club: 2,
  'compatriots-era': 2,
  compatriots: 1,
  'league-era': 1,
  none: 0,
};

/** Seasons together from which a pair counts as legends. */
export const LEGEND_SEASONS = 5;

export type Link = {
  kind: LinkKind;
  value: number;
  /** teammates / legends / club: the club (strongest one, most seasons together). */
  clubSlug?: string;
  league?: League;
  /** teammates / legends: seasons played together at that club. */
  seasonsTogether?: number[];
  /** compatriots: the shared nationality. */
  nationality?: string;
};

const NO_LINK: Link = { kind: 'none', value: 0 };

const decadeOf = (season: number) => Math.floor(season / 10) * 10;
const span = (p: ChemistryProfile) => {
  const all = p.clubs.flatMap((c) => c.seasons);
  return all.length ? [Math.min(...all), Math.max(...all)] : null;
};

/** The strongest thing two players share. */
export function linkBetween(a: ChemistryProfile | null | undefined, b: ChemistryProfile | null | undefined): Link {
  if (!a || !b) return NO_LINK;

  // Team-mates: same club, same season. Keep the club with the most seasons together.
  let best: Link | null = null;
  let sameClub: Link | null = null;
  for (const ca of a.clubs) {
    for (const cb of b.clubs) {
      if (ca.league !== cb.league || ca.clubSlug !== cb.clubSlug) continue;
      sameClub ??= { kind: 'club', value: LINK_VALUES.club, clubSlug: ca.clubSlug, league: ca.league };
      const together = ca.seasons.filter((s) => cb.seasons.includes(s)).sort((x, y) => x - y);
      if (together.length && (!best || together.length > best.seasonsTogether!.length)) {
        const kind: LinkKind = together.length >= LEGEND_SEASONS ? 'legends' : 'teammates';
        best = { kind, value: LINK_VALUES[kind], clubSlug: ca.clubSlug, league: ca.league, seasonsTogether: together };
      }
    }
  }
  if (best) return best;
  if (sameClub) return sameClub;

  const nationality = a.nationalities.find((n) => b.nationalities.includes(n));
  if (nationality) {
    const sa = span(a);
    const sb = span(b);
    const overlap = sa && sb && sa[0] <= sb[1] && sb[0] <= sa[1];
    const kind: LinkKind = overlap ? 'compatriots-era' : 'compatriots';
    return { kind, value: LINK_VALUES[kind], nationality };
  }

  for (const ca of a.clubs) {
    for (const cb of b.clubs) {
      if (ca.league !== cb.league) continue;
      const decades = new Set(ca.seasons.map(decadeOf));
      if (cb.seasons.some((s) => decades.has(decadeOf(s)))) {
        return { kind: 'league-era', value: LINK_VALUES['league-era'], league: ca.league };
      }
    }
  }
  return NO_LINK;
}

/**
 * Which spots of a formation are linked: neighbours within a line, the nearest spot(s) in the next
 * line, and the keeper with the central defender(s). Index-aligned with formationLayout().
 */
export function formationLinks(formation: string): [number, number][] {
  const spots = formationLayout(formation);
  const counts = formation.split(' ')[0].split('-').map(Number).filter((n) => n > 0);
  const lines: number[][] = [];
  let next = 1;
  for (const count of counts) {
    lines.push(Array.from({ length: count }, (_, k) => next + k));
    next += count;
  }
  const byX = (line: number[]) => [...line].sort((i, j) => spots[i].x - spots[j].x);
  const links = new Set<string>();
  const add = (i: number, j: number) => links.add(i < j ? `${i}-${j}` : `${j}-${i}`);

  // Keeper: the one or two defenders closest to the middle.
  if (lines[0]) {
    const central = [...lines[0]].sort((i, j) => Math.abs(spots[i].x - 0.5) - Math.abs(spots[j].x - 0.5));
    const d0 = Math.abs(spots[central[0]].x - 0.5);
    for (const i of central.slice(0, 2)) if (Math.abs(spots[i].x - 0.5) - d0 < 0.15) add(0, i);
  }
  for (const line of lines) {
    const sorted = byX(line);
    for (let k = 1; k < sorted.length; k++) add(sorted[k - 1], sorted[k]);
  }
  // Between consecutive lines: every spot links to the nearest spot (by x) of the other line.
  for (let l = 1; l < lines.length; l++) {
    const [back, front] = [lines[l - 1], lines[l]];
    const nearest = (i: number, other: number[]) =>
      other.reduce((b, j) => (Math.abs(spots[j].x - spots[i].x) < Math.abs(spots[b].x - spots[i].x) ? j : b));
    for (const i of back) add(i, nearest(i, front));
    for (const j of front) add(j, nearest(j, back));
  }
  return [...links].map((k) => k.split('-').map(Number) as [number, number]).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
}

export type LinkResult = Link & { a: number; b: number };

export type ChemistryResult = {
  /** Every link of the formation between two filled spots. */
  links: LinkResult[];
  /** 0–3 per spot (−1 out of position), null for empty spots. */
  players: (number | null)[];
  /** How each player fits his spot (main / other position). */
  fits: PositionFit[];
  /** 0–100. Grows as the XI fills up. */
  team: number;
  bonuses: { id: 'dynasty' | 'golden-generation'; label: string }[];
  /** Multiplier for the team's strength: 0.92 … 1.08. */
  strengthFactor: number;
};

export const CHEMISTRY = {
  playerMax: 3,
  /** Player chemistry out of position (not his main or other position). */
  outOfPosition: -1,
  /** Share of the 100 that player points can reach; the rest comes from bonuses. */
  pointsShare: 90,
  bonus: 5,
  dynastyPlayers: 3,
  goldenPlayers: 4,
  goodLinkAverage: 1.5,
  minFactor: 0.92,
  factorRange: 0.16,
};

/** Chemistry of a (partly) filled lineup. `lineup` is index-aligned with formationLayout(). */
export function computeChemistry(formation: string, lineup: readonly (ChemistryPlayer | null)[]): ChemistryResult {
  const spots = formationLayout(formation);
  const roles = formationRoles(formation);
  const links: LinkResult[] = [];
  for (const [a, b] of formationLinks(formation)) {
    const pa = lineup[a];
    const pb = lineup[b];
    if (pa && pb) links.push({ ...linkBetween(pa.chemistry, pb.chemistry), a, b });
  }

  const fits: PositionFit[] = spots.map((spot, i) => {
    const p = lineup[i];
    return p ? positionFit(p, { code: spot.code, role: roles[i] }) : null;
  });

  const captain = lineup.findIndex((p) => p?.captain);
  const captainNeighbours = new Set(
    captain < 0
      ? []
      : formationLinks(formation).flatMap(([a, b]) => (a === captain ? [b] : b === captain ? [a] : [])),
  );

  const players = spots.map((_, i) => {
    if (!lineup[i]) return null;
    if (!fits[i]) return CHEMISTRY.outOfPosition;
    const own = links.filter((l) => l.a === i || l.b === i);
    let points = 0;
    if (fits[i] === 'main') points++;
    if (own.length && own.reduce((s, l) => s + l.value, 0) / own.length >= CHEMISTRY.goodLinkAverage) points++;
    if (own.some((l) => l.value >= LINK_VALUES.teammates)) points++;
    if (captainNeighbours.has(i)) points++;
    return Math.min(CHEMISTRY.playerMax, points);
  });

  const placed = lineup.filter((p): p is ChemistryPlayer => !!p);
  const bonuses: ChemistryResult['bonuses'] = [];

  const clubCount = new Map<string, number>();
  for (const p of placed) {
    for (const key of new Set((p.chemistry?.clubs ?? []).map((c) => `${c.league}|${c.clubSlug}`))) {
      clubCount.set(key, (clubCount.get(key) ?? 0) + 1);
    }
  }
  const dynasty = [...clubCount].find(([, n]) => n >= CHEMISTRY.dynastyPlayers);
  if (dynasty) bonuses.push({ id: 'dynasty', label: `Dynasty: ${dynasty[1]} players from ${dynasty[0].split('|')[1]}` });

  // Golden generation: a season in which 4+ compatriots of the XI were all playing.
  const byNation = new Map<string, [number, number][]>();
  for (const p of placed) {
    const s = p.chemistry && span(p.chemistry);
    const nation = p.chemistry?.nationalities[0];
    if (s && nation) byNation.set(nation, [...(byNation.get(nation) ?? []), s as [number, number]]);
  }
  for (const [nation, spans] of byNation) {
    if (spans.length < CHEMISTRY.goldenPlayers) continue;
    const most = Math.max(...spans.map(([from]) => spans.filter(([f, t]) => f <= from && from <= t).length));
    if (most >= CHEMISTRY.goldenPlayers) {
      bonuses.push({ id: 'golden-generation', label: `Golden generation: ${most} ${nation} players of one era` });
      break;
    }
  }

  const points = players.reduce<number>((s, p) => s + (p ?? 0), 0);
  const maxPoints = spots.length * CHEMISTRY.playerMax;
  const team = Math.max(0, Math.min(100, Math.round((points / maxPoints) * CHEMISTRY.pointsShare + bonuses.length * CHEMISTRY.bonus)));
  return {
    links,
    players,
    fits,
    team,
    bonuses,
    strengthFactor: CHEMISTRY.minFactor + (CHEMISTRY.factorRange * team) / 100,
  };
}

/**
 * Team chemistry after placing `player` on each open spot he fits (null where he can't go).
 * Drives the "+3" hints on the pitch and in the draft list.
 */
export function chemistryPreview(
  formation: string,
  lineup: readonly (ChemistryPlayer | null)[],
  player: ChemistryPlayer,
): { current: number; bySpot: (number | null)[]; best: { spot: number; team: number; gain: number } | null } {
  const current = computeChemistry(formation, lineup).team;
  const roles = formationRoles(formation);
  const spots = formationLayout(formation);
  let best: { spot: number; team: number; gain: number } | null = null;
  const bySpot = spots.map((spot, i) => {
    if (lineup[i] || !positionFit(player, { code: spot.code, role: roles[i] })) return null;
    const team = computeChemistry(formation, lineup.map((p, k) => (k === i ? player : p))).team;
    if (!best || team > best.team) best = { spot: i, team, gain: team - current };
    return team;
  });
  return { current, bySpot, best };
}

/** Spots that can never change hands: the goalkeeper stays in goal. */
export const isLockedSpot = (formation: string, spot: number) => formationRoles(formation)[spot] === 'GK';

/**
 * Lineup after swapping the players on `from` and `to`. Null when the swap isn't allowed: the
 * same spot, an empty spot (players only swap with placed players), or the goalkeeper's spot.
 */
export function swapSpots<T>(formation: string, lineup: readonly (T | null)[], from: number, to: number): (T | null)[] | null {
  if (from === to || !lineup[from] || !lineup[to] || isLockedSpot(formation, from) || isLockedSpot(formation, to)) return null;
  const next = [...lineup];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** "13 seasons together at Milan (1984–1996)" – why a link is as strong as it is. */
export function linkLabel(link: Link): string {
  const club = link.clubSlug ? link.clubSlug.split('-').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ') : '';
  const seasons = link.seasonsTogether ?? [];
  const years = seasons.length ? `${seasons[0]}–${String(seasons[seasons.length - 1] + 1).slice(2)}` : '';
  switch (link.kind) {
    case 'legends':
    case 'teammates':
      return `${seasons.length} season${seasons.length === 1 ? '' : 's'} together at ${club} (${years})`;
    case 'club':
      return `Both played for ${club}`;
    case 'compatriots-era':
      return `${link.nationality} team-mates of the same era`;
    case 'compatriots':
      return `Both ${link.nationality}`;
    case 'league-era':
      return `Rivals in the same league and decade`;
    default:
      return 'Nothing in common';
  }
}

export type SquadSummary = {
  /** Mean rating of the XI (players without a rating count as 0). */
  rating: number;
  chemistry: ChemistryResult;
  /** Rating × chemistry factor: the number the simulation will start from. */
  overall: number;
  /** Mean rating per line. */
  lines: Record<PlayerRole, number | null>;
  /** Strongest links first (team-mates and legends), for the "best partnerships" list. */
  partnerships: LinkResult[];
  /** Spots whose player is out of position. */
  outOfPosition: number[];
  linkCounts: Record<LinkKind, number>;
};

/** Everything the end-of-draft summary shows. `lineup` is index-aligned with formationLayout(). */
export function squadSummary(
  formation: string,
  lineup: readonly ((ChemistryPlayer & { rating?: number | null }) | null)[],
): SquadSummary {
  const chemistry = computeChemistry(formation, lineup);
  const roles = formationRoles(formation);
  const placed = lineup.filter((p): p is NonNullable<typeof p> => !!p);
  const rating = placed.length ? placed.reduce((s, p) => s + (p.rating ?? 0), 0) / placed.length : 0;
  const lines = Object.fromEntries(
    (['GK', 'DF', 'MF', 'FW'] as PlayerRole[]).map((role) => {
      const inLine = lineup.filter((p, i) => p && roles[i] === role) as NonNullable<(typeof lineup)[number]>[];
      return [role, inLine.length ? inLine.reduce((s, p) => s + (p.rating ?? 0), 0) / inLine.length : null];
    }),
  ) as Record<PlayerRole, number | null>;
  const linkCounts = Object.fromEntries(Object.keys(LINK_VALUES).map((k) => [k, 0])) as Record<LinkKind, number>;
  for (const l of chemistry.links) linkCounts[l.kind]++;
  return {
    rating,
    chemistry,
    overall: rating * chemistry.strengthFactor,
    lines,
    partnerships: chemistry.links
      .filter((l) => l.value >= LINK_VALUES.teammates)
      .sort((a, b) => b.value - a.value || (b.seasonsTogether?.length ?? 0) - (a.seasonsTogether?.length ?? 0)),
    outOfPosition: chemistry.fits.flatMap((fit, i) => (lineup[i] && !fit ? [i] : [])),
    linkCounts,
  };
}
