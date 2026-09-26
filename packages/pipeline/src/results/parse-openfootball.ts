import type { RatedLeague, RawMatch } from "./types";

const MONTHS: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

// "Fri Aug 22 2025", "Sat Aug 23", "[Sat Aug 23]"
const DATE_LINE = /^\[?(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?\s+([A-Z][a-z]{2})[a-z]*\.?\s+(\d{1,2})(?:\s+(\d{4}))?\]?$/;
// Leading kick-off time: "20:30", "18.45"
const TIME = /^\d{1,2}[:.]\d{2}\s+/;
// A score with optional extra time / penalties and half-time: "2-0 (1-0)", "4-1 a.e.t. (3-1, 1-0)",
// "4-3 pen. 1-0 a.e.t. (1-0, 1-0)"
const SCORE = String.raw`\d+-\d+(?:\s+pen\.\s+\d+-\d+\s+a\.e\.t\.|\s+a\.e\.t\.)?(?:\s*\([^)]*\))?`;
const V_FORMAT = new RegExp(String.raw`^(.+?)\s+v\s+(.+?)\s+(${SCORE})\s*$`);
const SCORE_BETWEEN = new RegExp(String.raw`^(.+?)\s+(${SCORE})\s+(.+?)$`);

/** Final score incl. extra time; after penalties the a.e.t. score (a draw). */
export function parseScore(s: string): [number, number] | null {
  const m = s.match(/(\d+)-(\d+)\s+a\.e\.t\./) ?? s.match(/(\d+)-(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** "AS Monaco (FRA)" → ["AS Monaco", "FRA"]. */
function splitCountry(team: string, fallback: string): [string, string] {
  const m = team.match(/^(.*?)\s*\(([A-Z]{3})\)$/);
  return m ? [m[1].trim(), m[2]] : [team.trim(), fallback];
}

/**
 * openfootball football.txt file (github.com/openfootball): one season of a league or a cup.
 * Two match-line styles exist: "Home v Away 2-1 (1-0)" and "Home 2-1 (1-0) Away".
 * Unplayed fixtures (no score) are skipped. `comp` is the league, or "EUR" for European cups,
 * where team names carry a country code: "Real Madrid CF (ESP)".
 */
export function parseOpenfootball(text: string, season: number, comp: RatedLeague | "EUR"): RawMatch[] {
  const out: RawMatch[] = [];
  let year = season;
  let date = iso(season, 8, 1);
  let neutral = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("=") || line.startsWith("(") || (line.startsWith("[") && !DATE_LINE.test(line))) continue;
    if (line.startsWith("▪") || line.startsWith("»")) {
      // Round header ("▪ Final", "▪ Finals, Final"). Only the final is at a neutral ground.
      neutral = /(?:^|,\s*)Final$/i.test(line.replace(/^[▪»]\s*/, "").trim());
      continue;
    }
    const d = line.match(DATE_LINE);
    if (d) {
      const month = MONTHS[d[1]];
      if (!month) continue;
      if (d[3]) year = Number(d[3]);
      else {
        // No year given: take the one closest to the previous date (fixtures are listed in order,
        // but a rescheduled match can be listed out of order).
        const prevMonth = Number(date.slice(5, 7));
        if (prevMonth - month > 6) year++;
        else if (month - prevMonth > 6) year--;
      }
      date = iso(year, month, Number(d[2]));
      continue;
    }

    // Awarded / cancelled matches were not played.
    if (/\[(?:awarded|cancelled|annulled|abandoned|postponed)/i.test(line)) continue;
    const body = line.replace(TIME, "").replace(/\s+@\s+.*$/, "");
    let home: string;
    let away: string;
    let score: string;
    const v = body.match(V_FORMAT);
    const b = v ? null : body.match(SCORE_BETWEEN);
    if (v) [, home, away, score] = v;
    else if (b) [, home, score, away] = b;
    else continue;
    const goals = parseScore(score);
    if (!goals) continue;

    const [homeName, homeCountry] = splitCountry(home, comp);
    const [awayName, awayCountry] = splitCountry(away, comp);
    out.push({
      date,
      season,
      comp,
      home: homeName,
      away: awayName,
      homeCountry,
      awayCountry,
      homeGoals: goals[0],
      awayGoals: goals[1],
      neutral: comp === "EUR" && neutral,
    });
  }
  return out;
}
