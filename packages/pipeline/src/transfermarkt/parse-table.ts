import * as cheerio from "cheerio";

export type TmTableRow = {
  tmId: number;
  name: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  /** As shown for that season (2 points per win before the mid-1990s). */
  points: number;
};

export type TmTable = { rows: TmTableRow[]; problems: string[] };

/**
 * Parses /<league>/tabelle/wettbewerb/<COMP>/saison_id/<season>.
 * Per row: position, club link (/verein/<id>), then played, won, drawn, lost, "GF:GA",
 * goal difference, points. Old seasons show points as "45:23" (plus:minus points); the first
 * number is kept. Columns are located by shape (the "x:y" goals cell), not by fixed index.
 */
export function parseLeagueTable(html: string): TmTable {
  const $ = cheerio.load(html);
  const rows: TmTableRow[] = [];
  const problems: string[] = [];

  $("table.items")
    .first()
    .find("> tbody > tr")
    .each((i, tr) => {
      const cells = $(tr)
        .children("td")
        .map((_, td) => $(td).text().replace(/\s+/g, " ").trim())
        .get();
      const link = $(tr).find('a[href*="/verein/"]').filter((_, a) => $(a).text().trim() !== "").first();
      const tmId = Number(link.attr("href")?.match(/\/verein\/(\d+)/)?.[1]);
      const goalsAt = cells.findIndex((c) => /^\d+:\d+$/.test(c));
      if (!tmId || goalsAt < 4) return void problems.push(`Row ${i + 1}: unexpected layout (${cells.join(" | ")})`);

      const [played, won, drawn, lost] = cells.slice(goalsAt - 4, goalsAt).map(Number);
      const [goalsFor, goalsAgainst] = cells[goalsAt].split(":").map(Number);
      const points = Number(cells[cells.length - 1].split(":")[0]);
      const position = Number(cells[0].match(/^\d+/)?.[0] ?? i + 1);

      if ([played, won, drawn, lost, points].some((n) => !Number.isInteger(n))) {
        return void problems.push(`Row ${i + 1}: non-numeric values (${cells.join(" | ")})`);
      }
      if (won + drawn + lost !== played) problems.push(`${link.text().trim()}: W+D+L ≠ played`);
      rows.push({
        tmId,
        name: (link.attr("title") || link.text()).trim(),
        position,
        played,
        won,
        drawn,
        lost,
        goalsFor,
        goalsAgainst,
        points,
      });
    });

  const gf = rows.reduce((s, r) => s + r.goalsFor, 0);
  const ga = rows.reduce((s, r) => s + r.goalsAgainst, 0);
  if (rows.length && gf !== ga) problems.push(`Goals for (${gf}) ≠ goals against (${ga}) over the league`);
  return { rows, problems };
}
