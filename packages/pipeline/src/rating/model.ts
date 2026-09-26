import type { ClubSeason, PlayerRole, SquadPlayer } from "@champion/shared";

/**
 * Player rating, 0–100 per player season (Lionel Messi 2011/12 = 100).
 *
 * Every stat is measured against the same league season's players at the same position
 * (z-score among the regulars), so a 1965 season is judged by 1965 standards and a Ligue 1
 * season by Ligue 1 standards. Club strength (our Elo, compared across all five leagues within
 * the season) then says how much that league-season standard is worth.
 *
 *   FW  0.40 output + 0.15 share of team goals + 0.15 playing time + 0.10 team points/game + 0.20 club
 *   MF  0.30 output + 0.20 playing time + 0.15 team points/game + 0.10 team goal difference + 0.25 club
 *   DF  0.30 team goals against + 0.25 playing time + 0.10 output + 0.10 team points/game + 0.25 club
 *   GK  0.30 goals against /90 + 0.20 clean sheet % + 0.20 playing time + 0.10 team points/game + 0.20 club
 *
 * output = goals/90 + 0.6 × assists/90 (assists only in league seasons that record them).
 * The weighted sum is mapped per position: median regular = 60, the position's best season = 100.
 * Seasons under 1800 minutes are pulled toward 35 (few minutes = little evidence). Red cards
 * cost up to 5 points.
 */

export type RatingInput = {
  clubs: Pick<ClubSeason, "league" | "season" | "clubSlug" | "table" | "elo">[];
  players: Pick<
    SquadPlayer,
    | "league" | "season" | "clubSlug" | "nameSlug" | "position" | "appearances" | "goals" | "assists" | "minutes"
    | "pointsPerGame" | "cleanSheets" | "goalsConceded" | "redCards" | "secondYellowCards" | "tmPlayerId"
  >[];
};

export type Rating = {
  rating: number;
  /** Weighted z-score before scaling (for analysis). */
  raw: number;
  /** Share of the team's league minutes, 0–1. */
  share: number;
};

type Feature = "output" | "goalShare" | "share" | "ppg" | "teamGd" | "teamGa" | "ga90" | "cleanSheets" | "club";

const WEIGHTS: Record<PlayerRole, Partial<Record<Feature, number>>> = {
  FW: { output: 0.4, goalShare: 0.15, share: 0.15, ppg: 0.1, club: 0.2 },
  MF: { output: 0.3, share: 0.2, ppg: 0.15, teamGd: 0.1, club: 0.25 },
  DF: { teamGa: 0.3, share: 0.25, output: 0.1, ppg: 0.1, club: 0.25 },
  GK: { ga90: 0.3, cleanSheets: 0.2, share: 0.2, ppg: 0.1, club: 0.2 },
};

export const RATING = {
  /** A regular: at least this share of the team's league minutes (the comparison group). */
  regularShare: 0.35,
  /** z-scores are capped at ±4 (±2.5 for club strength: early Elo is less certain). */
  zCap: 4,
  clubZCap: 2.5,
  assistWeight: 0.6,
  /** A league season records assists if this share of its regulars has at least one. */
  assistsRecorded: 0.3,
  medianRating: 60,
  fullEvidenceMinutes: 1800,
  lowMinutesTarget: 35,
};

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const sd = (v: number[]) => {
  const m = mean(v);
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1;
};
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
const cap = (z: number, c: number) => Math.max(-c, Math.min(c, z));

export const playerKey = (p: { league: string; season: number; clubSlug: string; nameSlug: string }) =>
  `${p.league}|${p.season}|${p.clubSlug}|${p.nameSlug}`;

export function ratePlayers({ clubs, players }: RatingInput): Map<string, Rating> {
  const clubKey = (c: { league: string; season: number; clubSlug: string }) => `${c.league}|${c.season}|${c.clubSlug}`;
  const clubAt = new Map(clubs.map((c) => [clubKey(c), c]));

  // Club strength: Elo z-score among all five leagues' clubs of that season.
  const eloBySeason = new Map<number, number[]>();
  for (const c of clubs) if (c.elo) push(eloBySeason, c.season, c.elo);
  const clubZ = new Map<string, number>();
  for (const c of clubs) {
    const v = eloBySeason.get(c.season);
    clubZ.set(clubKey(c), c.elo && v && v.length > 1 ? cap((c.elo - mean(v)) / sd(v), RATING.clubZCap) : 0);
  }

  // Team defence and goal difference per game: z-score within the league season.
  const byLeagueSeason = new Map<string, typeof clubs>();
  for (const c of clubs) {
    push(byLeagueSeason, `${c.league}|${c.season}`, c);
  }
  const teamZ = new Map<string, { ga: number; gd: number }>();
  for (const list of byLeagueSeason.values()) {
    const withTable = list.filter((c) => c.table?.played);
    const ga = withTable.map((c) => c.table!.goalsAgainst / c.table!.played);
    const gd = withTable.map((c) => (c.table!.goalsFor - c.table!.goalsAgainst) / c.table!.played);
    for (const c of list) {
      const t = c.table;
      if (!t?.played || withTable.length < 4) teamZ.set(clubKey(c), { ga: 0, gd: 0 });
      else
        teamZ.set(clubKey(c), {
          ga: cap(-(t.goalsAgainst / t.played - mean(ga)) / sd(ga), RATING.zCap),
          gd: cap(((t.goalsFor - t.goalsAgainst) / t.played - mean(gd)) / sd(gd), RATING.zCap),
        });
    }
  }

  // Raw features per player season.
  type Row = { key: string; ls: string; position: PlayerRole; minutes: number; played: number; share: number; f: Partial<Record<Feature, number | null>>; p: RatingInput["players"][number] };
  const rows: Row[] = [];
  for (const p of players) {
    const c = clubAt.get(clubKey(p));
    const played = c?.table?.played;
    if (!c || !played) continue;
    const minutes = p.minutes ?? (p.appearances ?? 0) * 90;
    const share = Math.min(1, minutes / (played * 90));
    const per90 = (x: number | null | undefined) => (minutes > 0 && x != null ? (x / minutes) * 90 : null);
    rows.push({
      key: playerKey(p),
      ls: `${p.league}|${p.season}`,
      position: p.position,
      minutes,
      played,
      share,
      p,
      f: {
        output: null, // set below, once we know if the league season records assists
        goalShare: c.table!.goalsFor ? (p.goals ?? 0) / c.table!.goalsFor : 0,
        share,
        ppg: p.pointsPerGame ?? null,
        ga90: per90(p.goalsConceded),
        cleanSheets: p.cleanSheets != null && p.appearances ? p.cleanSheets / p.appearances : null,
      },
    });
  }

  const assistStats = new Map<string, { n: number; withAssist: number }>();
  for (const r of rows) {
    if (r.position === "GK" || r.share < RATING.regularShare) continue;
    const s = assistStats.get(r.ls) ?? { n: 0, withAssist: 0 };
    s.n++;
    if (r.p.assists) s.withAssist++;
    assistStats.set(r.ls, s);
  }
  for (const r of rows) {
    const s = assistStats.get(r.ls);
    const recorded = s && s.n ? s.withAssist / s.n >= RATING.assistsRecorded : false;
    const g90 = r.minutes > 0 ? ((r.p.goals ?? 0) / r.minutes) * 90 : 0;
    const a90 = recorded && r.minutes > 0 && r.p.assists != null ? (r.p.assists / r.minutes) * 90 : 0;
    r.f.output = g90 + RATING.assistWeight * a90;
  }

  // z-scores against the league season's regulars at the same position.
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    if (r.share < RATING.regularShare) continue;
    push(groups, `${r.ls}|${r.position}`, r);
  }
  const stats = new Map<string, { m: number; s: number } | null>();
  const z = (r: Row, feature: Feature): number => {
    const value = r.f[feature];
    if (value == null) return 0;
    const g = `${r.ls}|${r.position}|${feature}`;
    if (!stats.has(g)) {
      const vals = (groups.get(`${r.ls}|${r.position}`) ?? []).map((x) => x.f[feature]).filter((v): v is number => v != null);
      stats.set(g, vals.length >= 4 ? { m: mean(vals), s: sd(vals) } : null);
    }
    const st = stats.get(g);
    return st ? cap((value - st.m) / st.s, RATING.zCap) : 0;
  };

  const raw = new Map<string, number>();
  for (const r of rows) {
    const ck = `${r.p.league}|${r.p.season}|${r.p.clubSlug}`;
    let sum = 0;
    for (const [feature, w] of Object.entries(WEIGHTS[r.position]) as [Feature, number][]) {
      const value =
        feature === "club" ? clubZ.get(ck)! :
        feature === "teamGa" ? teamZ.get(ck)!.ga :
        feature === "teamGd" ? teamZ.get(ck)!.gd :
        feature === "ga90" ? -z(r, feature) : // fewer goals conceded is better
        z(r, feature);
      sum += w * value;
    }
    raw.set(r.key, sum);
  }

  // Scale per position: median regular (full season sample) = 60, best season = 100.
  const scale = new Map<PlayerRole, { med: number; best: number }>();
  for (const pos of ["GK", "DF", "MF", "FW"] as PlayerRole[]) {
    const regular = rows.filter((r) => r.position === pos && r.share >= RATING.regularShare && r.played >= 20).map((r) => raw.get(r.key)!);
    if (regular.length) scale.set(pos, { med: median(regular), best: Math.max(...regular) });
  }

  const out = new Map<string, Rating>();
  for (const r of rows) {
    const s = scale.get(r.position);
    const x = raw.get(r.key)!;
    if (!s) continue;
    let rating = RATING.medianRating + ((100 - RATING.medianRating) * (x - s.med)) / (s.best - s.med);
    const evidence = Math.min(1, r.minutes / RATING.fullEvidenceMinutes);
    if (rating > RATING.lowMinutesTarget) rating = RATING.lowMinutesTarget + (rating - RATING.lowMinutesTarget) * evidence;
    rating -= Math.min(5, 1.5 * (r.p.redCards ?? 0) + 0.75 * (r.p.secondYellowCards ?? 0));
    out.set(r.key, { rating: Math.round(Math.max(1, Math.min(100, rating)) * 10) / 10, raw: x, share: r.share });
  }
  return out;
}

/**
 * Rating for picking a player from a club decade: 0.7 × best season + 0.3 × second best at that
 * club in that decade (one season only: the second counts as 15 points lower).
 */
export function decadeRatings(
  seasons: { league: string; clubSlug: string; season: number; player: string; key: string; rating: number }[],
): Map<string, number> {
  const groups = new Map<string, typeof seasons>();
  for (const s of seasons) {
    push(groups, `${s.league}|${s.clubSlug}|${Math.floor(s.season / 10) * 10}|${s.player}`, s);
  }
  const out = new Map<string, number>();
  for (const list of groups.values()) {
    const [best, second] = list.map((s) => s.rating).sort((a, b) => b - a);
    const value = Math.round((0.7 * best + 0.3 * (second ?? best - 15)) * 10) / 10;
    for (const s of list) out.set(s.key, value);
  }
  return out;
}
