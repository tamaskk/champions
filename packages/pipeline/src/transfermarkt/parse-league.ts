import * as cheerio from "cheerio";

export type TmClub = { tmId: number; tmSlug: string; name: string };

const CLUB_HREF = /^\/([^/]+)\/startseite\/verein\/(\d+)(?:\/saison_id\/(\d+))?/;

/**
 * Clubs of one league season from the league overview page. Pure: HTML in, clubs out.
 * The first `table.items` on the page is the club list; its name links point to /startseite/verein/<id>.
 */
export function parseLeagueClubs(html: string): TmClub[] {
  const $ = cheerio.load(html);
  const clubs: TmClub[] = [];
  const seen = new Set<number>();

  $("table.items")
    .first()
    .find("> tbody > tr")
    .each((_, row) => {
      const link = $(row).find("td.hauptlink a").first();
      const match = link.attr("href")?.match(CLUB_HREF);
      if (!match) return;
      const tmId = Number(match[2]);
      if (seen.has(tmId)) return;
      seen.add(tmId);
      clubs.push({ tmId, tmSlug: match[1], name: (link.attr("title") || link.text()).trim() });
    });

  return clubs;
}
