import * as cheerio from "cheerio";

/** One goalkeeper row of a league season's "Clean sheets (Detailed view)" page. */
export type TmKeeperRow = {
  tmPlayerId: number;
  name: string;
  matches: number | null;
  cleanSheets: number | null;
  goalsConceded: number | null;
  minutes: number | null;
};

export type TmKeeperPage = { rows: TmKeeperRow[]; hasNextPage: boolean };

const num = (text: string | undefined) => {
  const t = (text ?? "").trim().replace(/['’]/g, "").replace(/\./g, "");
  if (t === "-" || t === "") return 0;
  return /^\d+$/.test(t) ? Number(t) : null;
};

/**
 * Parses /<league>/weisseweste/wettbewerb/<COMP>/saison_id/<season>/plus/1[/page/<n>].
 * The page is a league-wide ranking (25 keepers per page), so rows carry only the player id;
 * the caller attaches them to our squads by tmPlayerId. Columns are found by header sort key.
 */
export function parseKeepers(html: string, page: number): TmKeeperPage {
  const $ = cheerio.load(html);
  const table = $("table.items").first();
  const columns: (string | null)[] = [];
  table.find("> thead > tr > th").each((_, th) => {
    const key = ($(th).find("a").attr("href") ?? "").match(/\/sort\/([a-z_]+)/)?.[1] ?? null;
    const span = Number($(th).attr("colspan") ?? 1);
    for (let i = 0; i < span; i++) columns.push(i === 0 ? key : null);
  });
  const at = (key: string) => columns.indexOf(key);
  const idx = {
    matches: at("anzahl"),
    cleanSheets: at("zu_null"),
    conceded: at("kassierte_tore"),
    minutes: at("spielminuten"),
  };

  const rows: TmKeeperRow[] = [];
  table.find("> tbody > tr").each((_, tr) => {
    const cells = $(tr).children("td");
    const link = $(tr).find('a[href*="/profil/spieler/"]').first();
    const id = link.attr("href")?.match(/\/profil\/spieler\/(\d+)/)?.[1];
    if (!id) return;
    const cell = (i: number) => (i >= 0 ? cells.eq(i).text() : undefined);
    rows.push({
      tmPlayerId: Number(id),
      name: (link.attr("title") || link.text()).trim(),
      matches: idx.matches >= 0 ? num(cell(idx.matches)) : null,
      cleanSheets: idx.cleanSheets >= 0 ? num(cell(idx.cleanSheets)) : null,
      goalsConceded: idx.conceded >= 0 ? num(cell(idx.conceded)) : null,
      minutes: idx.minutes >= 0 ? num(cell(idx.minutes)) : null,
    });
  });

  const hasNextPage = $(`a[href*="/page/${page + 1}"]`).length > 0;
  return { rows, hasNextPage };
}
