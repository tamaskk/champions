/**
 * Matches our club names (common English names, e.g. "Cologne", "Inter Milan") to another
 * source's club list for the SAME league season (e.g. Transfermarkt's "1.FC Köln", "Inter Milan").
 * Within one league season there are only ~20 candidates, so a token similarity plus a
 * greedy best-first assignment is reliable. Weak matches are returned flagged, never hidden.
 */

// Words that say nothing about which club it is.
const STOPWORDS = new Set([
  "fc", "cf", "ac", "as", "sc", "sv", "ssc", "afc", "us", "ud", "cd", "rc", "rcd", "sd", "club",
  "de", "del", "la", "le", "les", "calcio", "fk", "tsv", "vfl", "vfb", "bv", "sk", "ogc", "osc",
  "cfc", "football", "futbol", "the", "and", "1", "e", "v", "s", "ss", "acf", "fbc", "asc",
  "spvgg", "ev", "kfc", "hsc", "sad", "sa", "ea", "aj", "sco", "lb", "gd", "ca", "fsv", "ssv", "cs",
  "stade", "olympique", "sp",
]);

// English / local spellings that should count as the same word.
const SYNONYMS: Record<string, string> = {
  munich: "munchen", muenchen: "munchen", cologne: "koln", koeln: "koln", milano: "milan",
  turin: "torino", naples: "napoli", rome: "roma", florence: "fiorentina", genoa: "genova",
  internazionale: "inter", saint: "st", seville: "sevilla", corunna: "coruna",
  gladbach: "monchengladbach", nuremberg: "nurnberg", nuernberg: "nurnberg", hanover: "hannover",
  brunswick: "braunschweig", utd: "united", marseilles: "marseille", lyons: "lyon",
  // ClubElo short names
  man: "manchester", weds: "wednesday", brom: "bromwich", wolves: "wolverhampton", spurs: "tottenham",
  sg: "germain", psg: "germain",
  // Transfermarkt's historical / local club names
  rennais: "rennes", lavallois: "laval", brestois: "brest", avignonnais: "avignon", aixoise: "aix",
  meidericher: "duisburg", ars: "spal", lyonnais: "lyon", rasenballsport: "rb", bor: "borussia",
};

export function nameTokens(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((t) => SYNONYMS[t] ?? t)
    .filter((t) => !STOPWORDS.has(t));
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1);
  return m;
}

function dice(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let overlap = 0;
  for (const [k, n] of A) overlap += Math.min(n, B.get(k) ?? 0);
  return (2 * overlap) / (a.length - 1 + (b.length - 1));
}

/** 0..1. Token overlap, with partial credit for near-identical tokens ("hotspur"/"hotspurs"). */
export function clubSimilarity(a: string, b: string): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.length === 0 || tb.length === 0) return dice(a.toLowerCase(), b.toLowerCase());

  const tokenScore = (xs: string[], ys: string[]) =>
    xs.reduce((sum, x) => sum + Math.max(...ys.map((y) => (x === y ? 1 : dice(x, y) >= 0.8 ? 0.8 : 0))), 0) / xs.length;
  // Average both directions: "Bayern" ⊂ "Bayern Munich" scores well but below an exact match.
  const tokens = (tokenScore(ta, tb) + tokenScore(tb, ta)) / 2;
  const whole = dice(ta.join(" "), tb.join(" "));
  return Math.max(tokens, whole * 0.9);
}

export type ClubMatch<O, T> = { ours: O; theirs: T; score: number; how: "alias" | "known" | "name" | "last-left" };

/**
 * Assigns each of `ours` to at most one of `theirs`.
 * 1. `known(ours)` → an id already decided wins outright: `{ id, how: "alias" }` from the alias
 *    file, `{ id, how: "known" }` from a confident link in another season.
 * 2. Greedy on similarity, best pairs first, each side used once, score >= minScore.
 * 3. If exactly one club is left on each side, they are paired ("last-left") – flagged for review.
 */
export function matchClubs<O, T>(
  ours: O[],
  theirs: T[],
  opts: {
    oursName: (o: O) => string;
    /** One name, or several (e.g. Transfermarkt's name and ours): the best one counts. */
    theirsName: (t: T) => string | string[];
    theirsId: (t: T) => number;
    known?: (o: O) => { id: number; how: "alias" | "known" } | undefined;
    minScore?: number;
    /** A single leftover pair is only accepted from this score on (default 0.25). */
    minLastLeftScore?: number;
  },
): { matches: ClubMatch<O, T>[]; unmatchedOurs: O[]; unmatchedTheirs: T[] } {
  const minScore = opts.minScore ?? 0.6;
  const similarity = (o: O, t: T) => {
    const names = opts.theirsName(t);
    return Math.max(...(Array.isArray(names) ? names : [names]).map((n) => clubSimilarity(opts.oursName(o), n)));
  };
  const matches: ClubMatch<O, T>[] = [];
  const usedOurs = new Set<number>();
  const usedTheirs = new Set<number>();

  ours.forEach((o, i) => {
    const known = opts.known?.(o);
    if (!known) return;
    const j = theirs.findIndex((t, k) => !usedTheirs.has(k) && opts.theirsId(t) === known.id);
    if (j < 0) return;
    const score = similarity(o, theirs[j]);
    matches.push({ ours: o, theirs: theirs[j], score, how: known.how });
    usedOurs.add(i);
    usedTheirs.add(j);
  });

  const pairs: { i: number; j: number; score: number }[] = [];
  ours.forEach((o, i) => {
    if (usedOurs.has(i)) return;
    theirs.forEach((t, j) => {
      if (usedTheirs.has(j)) return;
      pairs.push({ i, j, score: similarity(o, t) });
    });
  });
  pairs.sort((a, b) => b.score - a.score);
  for (const { i, j, score } of pairs) {
    if (score < minScore) break;
    if (usedOurs.has(i) || usedTheirs.has(j)) continue;
    matches.push({ ours: ours[i], theirs: theirs[j], score, how: "name" });
    usedOurs.add(i);
    usedTheirs.add(j);
  }

  const leftOurs = ours.filter((_, i) => !usedOurs.has(i));
  const leftTheirs = theirs.filter((_, j) => !usedTheirs.has(j));
  // Only when the names are at least somewhat alike: a leftover pair with unrelated names
  // (e.g. "Blackburn Rovers" / "Notts County") means our club list is wrong for that season.
  const lastScore =
    leftOurs.length === 1 && leftTheirs.length === 1
      ? similarity(leftOurs[0], leftTheirs[0])
      : -1;
  if (lastScore >= (opts.minLastLeftScore ?? 0.25)) {
    matches.push({ ours: leftOurs[0], theirs: leftTheirs[0], score: lastScore, how: "last-left" });
    return { matches, unmatchedOurs: [], unmatchedTheirs: [] };
  }
  return { matches, unmatchedOurs: leftOurs, unmatchedTheirs: leftTheirs };
}
