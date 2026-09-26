import type { League } from "@champion/shared";

export const TM_BASE = "https://www.transfermarkt.com";

/**
 * Transfermarkt competition code of a league's top flight in a season (start year).
 * England: the old First Division is EFD1 up to 1991/92; GB1 is the Premier League from 1992/93.
 */
export function tmCompetition(league: League, season: number): string {
  switch (league) {
    case "ENG":
      return season <= 1991 ? "EFD1" : "GB1";
    case "ESP":
      return "ES1";
    case "ITA":
      return "IT1";
    case "GER":
      return "L1";
    case "FRA":
      return "FR1";
  }
}

/** League overview page; its first table lists every club of the season with its Transfermarkt id. */
export function leagueSeasonUrl(league: League, season: number): string {
  // The slug in front of /startseite is ignored by Transfermarkt; any value works.
  return `${TM_BASE}/league/startseite/wettbewerb/${tmCompetition(league, season)}/plus/?saison_id=${season}`;
}

/** League-wide goalkeeper table (detailed view): matches, clean sheets, goals conceded, minutes. 25 per page. */
export function keepersUrl(league: League, season: number, page = 1): string {
  return `${TM_BASE}/league/weisseweste/wettbewerb/${tmCompetition(league, season)}/saison_id/${season}/plus/1${page > 1 ? `/page/${page}` : ""}`;
}

/** Club squad statistics for one league season, detailed view (appearances, goals, assists, minutes, ...). */
export function clubSeasonStatsUrl(league: League, season: number, tmClubId: number, tmClubSlug = "club"): string {
  return `${TM_BASE}/${tmClubSlug}/leistungsdaten/verein/${tmClubId}/reldata/${tmCompetition(league, season)}%26${season}/plus/1`;
}

/** Final league table: position, played, won, drawn, lost, goals for:against, points. */
export function leagueTableUrl(league: League, season: number): string {
  return `${TM_BASE}/league/tabelle/wettbewerb/${tmCompetition(league, season)}/saison_id/${season}`;
}
