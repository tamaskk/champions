import type { RatedLeague, RawMatch } from "./types";

/** Minimal RFC-4180 CSV reader (quoted fields, "" escapes). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const num = (v: string | undefined) => (v === undefined || v === "" || v === "NA" ? null : Number(v));

/**
 * engsoccerdata league file (england.csv, spain.csv, …): top-flight matches only (tier 1).
 * Columns used: Date, Season, home, visitor, hgoal, vgoal, tier.
 */
export function parseEsdLeague(csv: string, league: RatedLeague): RawMatch[] {
  const out: RawMatch[] = [];
  for (const r of parseCsv(csv)) {
    if (r.tier !== "1") continue;
    const homeGoals = num(r.hgoal);
    const awayGoals = num(r.vgoal);
    const season = num(r.Season);
    if (homeGoals === null || awayGoals === null || season === null || !/^\d{4}-\d{2}-\d{2}$/.test(r.Date)) continue;
    out.push({
      date: r.Date,
      season,
      comp: league,
      home: r.home,
      away: r.visitor,
      homeCountry: league,
      awayCountry: league,
      homeGoals,
      awayGoals,
      neutral: false,
    });
  }
  return out;
}

/**
 * engsoccerdata champs.csv: European Cup / Champions League. Score incl. extra time
 * (tothgoal/totvgoal) when present. Finals are neutral.
 */
export function parseEsdChamps(csv: string, maxSeason: number): RawMatch[] {
  const out: RawMatch[] = [];
  for (const r of parseCsv(csv)) {
    const season = num(r.Season);
    if (season === null || season > maxSeason) continue;
    const homeGoals = num(r.tothgoal) ?? num(r.hgoal);
    const awayGoals = num(r.totvgoal) ?? num(r.vgoal);
    if (homeGoals === null || awayGoals === null || !/^\d{4}-\d{2}-\d{2}$/.test(r.Date)) continue;
    out.push({
      date: r.Date,
      season,
      comp: "EUR",
      home: r.home,
      away: r.visitor,
      homeCountry: r.hcountry,
      awayCountry: r.vcountry,
      homeGoals,
      awayGoals,
      neutral: r.round === "final",
    });
  }
  return out;
}
