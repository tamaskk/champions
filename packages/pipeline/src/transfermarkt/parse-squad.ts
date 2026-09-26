import type { PlayerRole } from "@champion/shared";
import * as cheerio from "cheerio";

/** One row of a club's "Squad statistics (Detailed view)" page for one league season. */
export type TmSquadRow = {
  tmPlayerId: number;
  name: string;
  role: PlayerRole;
  /** Detailed Transfermarkt position, e.g. "Centre-Back", "Left Winger". */
  position: string;
  /** Flag titles, primary nationality first (e.g. ["France", "Guadeloupe"]). */
  nationalities: string[];
  /** Age as Transfermarkt shows it for that season. */
  age: number | null;
  /** Matchday squad call-ups (null when the page shows none). */
  inSquad: number | null;
  appearances: number;
  goals: number;
  // The fields below are null when the whole page has no data for them (typical before the
  // 1990s: Transfermarkt shows "-" for everyone, which would otherwise look like 0).
  assists: number | null;
  yellowCards: number | null;
  secondYellowCards: number | null;
  redCards: number | null;
  subsOn: number | null;
  subsOff: number | null;
  /** Team points per game while the player played. */
  pointsPerGame: number | null;
  minutes: number | null;
};

export type TmSquadPage = {
  /** `reldata` value of the selected season, e.g. "L1&1975". null if the page has no season picker. */
  selected: string | null;
  /** "... have played 34 games so far" → 34. */
  teamGames: number | null;
  rows: TmSquadRow[];
  warnings: string[];
};

// Background class of the first cell → position group.
const ROLE_BY_CLASS: Record<string, PlayerRole> = {
  bg_Torwart: "GK",
  bg_Abwehr: "DF",
  bg_Mittelfeld: "MF",
  bg_Sturm: "FW",
};

// Fallback when the class is missing: detailed position text → group.
function roleFromPosition(position: string): PlayerRole | null {
  const p = position.toLowerCase();
  if (p.includes("goalkeeper")) return "GK";
  if (/(back|defen|sweeper|libero)/.test(p)) return "DF";
  if (p.includes("midfield")) return "MF";
  if (/(forward|striker|winger|attack)/.test(p)) return "FW";
  return null;
}

/** "-" or empty → 0; "1.234'" → 1234; anything else non-numeric (e.g. "Not used ...") → null. */
function count(text: string | undefined): number | null {
  const t = (text ?? "").trim().replace(/['’]/g, "");
  if (t === "" || t === "-") return 0;
  const digits = t.replace(/\./g, "");
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

/** "1.62" or "0,00" → number; "-" / empty → null. */
function decimal(text: string | undefined): number | null {
  const t = (text ?? "").trim().replace(",", ".");
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

// Header sort keys (the /sort/<key> part of each column's link) → our stat names.
const STAT_COLUMNS = {
  inSquad: "im_kader",
  appearances: "einsaetze",
  goals: "tore",
  assists: "vorlagen",
  yellowCards: "gelbe",
  secondYellowCards: "gelbrote",
  redCards: "rote",
  subsOn: "einwechslungen",
  subsOff: "auswechslungen",
  minutes: "einsatzzeit",
} as const;
type CountStat = keyof typeof STAT_COLUMNS;

// Columns that only mean something together: if none of them has a single non-zero value on the
// page, Transfermarkt has no data for that era and they're stored as null, not 0.
const STAT_GROUPS: CountStat[][] = [
  ["assists"],
  ["yellowCards", "secondYellowCards", "redCards"],
  ["subsOn", "subsOff"],
];

/**
 * Parses the detailed club statistics page:
 *   /<club>/leistungsdaten/verein/<id>/reldata/<COMP>%26<season>/plus/1
 * Columns are located through the header's sort keys, not by position, so extra or reordered
 * columns don't shift the numbers.
 */
export function parseSquadStats(html: string): TmSquadPage {
  const $ = cheerio.load(html);
  const warnings: string[] = [];

  const selected = $('select[name="reldata"] option[selected]').attr("value") ?? null;
  const games = $("body").text().match(/played (\d+) games/);
  const teamGames = games ? Number(games[1]) : null;

  const table = $("table.items").first();
  if (table.length === 0) return { selected, teamGames, rows: [], warnings: ["No squad table on the page"] };

  // Header column index → key: the sort link ends in /sort/<key>[.desc]; Nat. has no link.
  const columns: (string | null)[] = [];
  table.find("> thead > tr > th").each((_, th) => {
    const href = $(th).find("a").attr("href") ?? "";
    const key = href.match(/\/sort\/([a-z_]+)/)?.[1] ?? null;
    const span = Number($(th).attr("colspan") ?? 1);
    for (let i = 0; i < span; i++) columns.push(i === 0 ? (key ?? ($(th).text().trim() === "Nat." ? "nat" : null)) : null);
  });
  const col = (key: string) => columns.indexOf(key);
  const idx = { player: col("spieler"), age: col("age"), nat: col("nat"), ppg: col("pps") };
  if (col(STAT_COLUMNS.appearances) < 0 || col(STAT_COLUMNS.goals) < 0 || idx.player < 0) {
    return { selected, teamGames, rows: [], warnings: ["Squad table has no appearances/goals columns"] };
  }

  type Raw = Omit<TmSquadRow, CountStat | "pointsPerGame"> & {
    didNotPlay: boolean;
    stats: Record<CountStat, number | null>;
    ppg: number | null;
  };
  const raws: Raw[] = [];

  table.find("> tbody > tr").each((i, tr) => {
    // Hidden duplicate cells exist for "not used" rows; expand colspans to header positions.
    const cells: string[] = [];
    const cellEls: ReturnType<typeof $>[] = [];
    $(tr)
      .children("td")
      .each((_, td) => {
        const $td = $(td);
        if ($td.hasClass("hide")) return;
        const span = Number($td.attr("colspan") ?? 1);
        for (let k = 0; k < span; k++) {
          cells.push(k === 0 ? $td.text().trim() : "");
          cellEls.push($td);
        }
      });

    const playerCell = cellEls[idx.player];
    const link = playerCell?.find('a[href*="/profil/spieler/"]').first();
    const id = link?.attr("href")?.match(/\/profil\/spieler\/(\d+)/)?.[1];
    if (!playerCell || !link || !id) return void warnings.push(`Row ${i + 1}: no player link`);

    const name = (link.attr("title") || link.text()).trim();
    const position = playerCell.find("table.inline-table tr").eq(1).text().trim();
    const firstClass = ($(tr).children("td").first().attr("class") ?? "").split(/\s+/).find((c) => c in ROLE_BY_CLASS);
    const role = (firstClass && ROLE_BY_CLASS[firstClass]) || roleFromPosition(position);
    if (!role) return void warnings.push(`${name}: unknown position "${position}"`);

    // A colspan cell like "Not used during this season" sits where the appearances start.
    const appsText = cells[col(STAT_COLUMNS.appearances)] ?? "";
    const didNotPlay = !/^[\d-]*$/.test(appsText.replace(/\s/g, ""));

    const stats = {} as Record<CountStat, number | null>;
    for (const [stat, key] of Object.entries(STAT_COLUMNS) as [CountStat, string][]) {
      const at = col(key);
      stats[stat] = at < 0 ? null : stat === "inSquad" || !didNotPlay ? count(cells[at]) : 0;
    }

    const nationalities =
      (idx.nat >= 0 ? cellEls[idx.nat] : undefined)
        ?.find("img")
        .map((_, img) => $(img).attr("title")?.trim() ?? "")
        .get()
        .filter(Boolean) ?? [];

    raws.push({
      tmPlayerId: Number(id),
      name,
      role,
      position,
      nationalities,
      age: idx.age >= 0 ? count(cells[idx.age]) || null : null,
      didNotPlay,
      stats,
      ppg: didNotPlay || idx.ppg < 0 ? null : decimal(cells[idx.ppg]),
    });
  });

  // Which stat groups have any data on this page.
  const hasData = new Set<CountStat>();
  for (const group of STAT_GROUPS) {
    if (raws.some((r) => group.some((s) => (r.stats[s] ?? 0) > 0))) group.forEach((s) => hasData.add(s));
  }
  const grouped = new Set(STAT_GROUPS.flat());
  const value = (r: Raw, stat: CountStat) => (grouped.has(stat) && !hasData.has(stat) ? null : r.stats[stat]);

  const rows: TmSquadRow[] = raws.map((r) => ({
    tmPlayerId: r.tmPlayerId,
    name: r.name,
    role: r.role,
    position: r.position,
    nationalities: r.nationalities,
    age: r.age,
    inSquad: r.stats.inSquad,
    appearances: r.stats.appearances ?? 0,
    goals: r.stats.goals ?? 0,
    assists: value(r, "assists"),
    yellowCards: value(r, "yellowCards"),
    secondYellowCards: value(r, "secondYellowCards"),
    redCards: value(r, "redCards"),
    subsOn: value(r, "subsOn"),
    subsOff: value(r, "subsOff"),
    pointsPerGame: r.ppg,
    minutes: r.stats.minutes,
  }));

  return { selected, teamGames, rows, warnings };
}
