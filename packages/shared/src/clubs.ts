import { LEAGUES, LEAGUE_NAMES, type League } from './leagues';

/** A club playing in a league in a given season. `season` is the start year: 1975 = 1975/76. */
export type ClubSeason = {
  league: League;
  season: number;
  decade: number;
  club: string;
  clubSlug: string;
  source: string | null;
  /** Final league table line (pipeline: tm:tables). */
  table?: LeagueTableLine | null;
  /**
   * Club strength that season (pipeline: elo): our own Elo rating computed from every top-flight
   * and European-cup result since the 19th century, averaged over the club's league matches that
   * season. Comparable across leagues and decades. Top clubs ~1700–1850, league average ~1450.
   */
  elo?: number | null;
  /**
   * "results": from that season's matches; "table": no match results, rated from the final table;
   * "carried": neither, the club's last known rating.
   */
  eloSource?: "results" | "table" | "carried" | null;
  /** League matches the rating is averaged over. */
  eloGames?: number | null;
};

export type LeagueTableLine = {
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  /** As awarded that season (2 points per win in older seasons). */
  points: number;
};

export const FIRST_SEASON = 1960;
export const LAST_SEASON = new Date().getFullYear();

export const decadeOf = (season: number) => Math.floor(season / 10) * 10;

/** 1975 -> "1975/76" */
export const seasonLabel = (season: number) => `${season}/${String(season + 1).slice(2)}`;

export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const LEAGUE_ALIASES: Record<string, League> = {
  eng: 'ENG', england: 'ENG', english: 'ENG', 'premier league': 'ENG', epl: 'ENG', 'first division': 'ENG',
  esp: 'ESP', spain: 'ESP', spanish: 'ESP', 'la liga': 'ESP', laliga: 'ESP', 'primera division': 'ESP',
  ita: 'ITA', italy: 'ITA', italian: 'ITA', 'serie a': 'ITA',
  ger: 'GER', germany: 'GER', german: 'GER', bundesliga: 'GER',
  fra: 'FRA', france: 'FRA', french: 'FRA', 'ligue 1': 'FRA', 'division 1': 'FRA',
};

export function parseLeague(input: string): League | null {
  const key = input.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if ((LEAGUES as readonly string[]).includes(key.toUpperCase())) return key.toUpperCase() as League;
  return LEAGUE_ALIASES[key] ?? null;
}

/** Accepts "1975", "1975/76", "1975-76", "1975-1976". Returns the start year. */
export function parseSeason(input: string): number | null {
  const match = input.trim().match(/^(\d{4})(?:\s*[/-]\s*\d{2,4})?$/);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= FIRST_SEASON && year <= LAST_SEASON ? year : null;
}

export type ImportError = { path: string; message: string };

export type ImportParseResult = {
  rows: ClubSeason[];
  errors: ImportError[];
  duplicates: number;
};

/** Shape of the import file. See apps/web/public/club-import-sample.json. */
export type ClubImportFile = {
  version: 1;
  source?: string;
  seasons: {
    league: string;
    season: number | string;
    source?: string;
    clubs: string[];
  }[];
};

export const CLUB_IMPORT_SAMPLE: ClubImportFile = {
  version: 1,
  source: 'historical-lineups.com',
  seasons: [
    {
      league: 'GER',
      season: 1975,
      clubs: ['Borussia Mönchengladbach', 'FC Schalke 04', 'Eintracht Braunschweig', 'Hamburger SV', '1. FC Köln'],
    },
    {
      league: 'ITA',
      season: '1975/76',
      clubs: ['Torino', 'Juventus', 'Milan', 'Internazionale'],
    },
    {
      league: 'ENG',
      season: 1975,
      source: 'fr.wikipedia.org',
      clubs: ['Liverpool', 'Queens Park Rangers', 'Manchester United', 'Derby County'],
    },
  ],
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Validates a parsed import file (see ClubImportFile) and flattens it into club-season rows.
 * Collects every problem instead of stopping at the first one; duplicates are dropped and counted.
 */
export function parseClubImport(input: unknown): ImportParseResult {
  const rows: ClubSeason[] = [];
  const errors: ImportError[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  if (!isRecord(input)) {
    return { rows, errors: [{ path: '$', message: 'Top level must be an object' }], duplicates };
  }
  if (input.version !== 1) errors.push({ path: 'version', message: 'Must be 1' });
  if (input.source !== undefined && typeof input.source !== 'string') {
    errors.push({ path: 'source', message: 'Must be a string' });
  }
  if (!Array.isArray(input.seasons)) {
    errors.push({ path: 'seasons', message: 'Must be an array' });
    return { rows, errors, duplicates };
  }
  const fileSource = typeof input.source === 'string' && input.source.trim() ? input.source.trim() : null;

  input.seasons.forEach((entry, i) => {
    const at = `seasons[${i}]`;
    if (!isRecord(entry)) return errors.push({ path: at, message: 'Must be an object' });

    const league = typeof entry.league === 'string' ? parseLeague(entry.league) : null;
    if (!league) errors.push({ path: `${at}.league`, message: `Unknown league ${JSON.stringify(entry.league)}` });

    const season =
      typeof entry.season === 'number' || typeof entry.season === 'string' ? parseSeason(String(entry.season)) : null;
    if (season === null) {
      errors.push({
        path: `${at}.season`,
        message: `Must be a start year between ${FIRST_SEASON} and ${LAST_SEASON}, e.g. 1975 or "1975/76"`,
      });
    }

    if (!Array.isArray(entry.clubs) || entry.clubs.length === 0) {
      return errors.push({ path: `${at}.clubs`, message: 'Must be a non-empty array of club names' });
    }
    if (!league || season === null) return;

    const source = typeof entry.source === 'string' && entry.source.trim() ? entry.source.trim() : fileSource;
    entry.clubs.forEach((club, j) => {
      if (typeof club !== 'string' || !slugify(club)) {
        return errors.push({ path: `${at}.clubs[${j}]`, message: 'Must be a non-empty club name' });
      }
      const name = club.trim().replace(/\s+/g, ' ');
      const row: ClubSeason = { league, season, decade: decadeOf(season), club: name, clubSlug: slugify(name), source };
      const key = `${league}|${season}|${row.clubSlug}`;
      if (seen.has(key)) return duplicates++;
      seen.add(key);
      rows.push(row);
    });
  });

  return { rows, errors, duplicates };
}

/** GET /api/clubs?league=GER&decade=1970 */
export type ClubsResponse = {
  league: League;
  decade: number;
  clubs: { club: string; clubSlug: string; seasons: number }[];
};

/** Prompt that asks an LLM for every club of every season of a decade, as a ClubImportFile. */
export function buildDecadeClubsPrompt(decade: number, leagues: readonly League[]): string {
  const lastSeason = Math.min(decade + 9, LAST_SEASON);
  const seasons = Array.from({ length: lastSeason - decade + 1 }, (_, i) => decade + i);
  const leagueList = leagues.map((l) => `${l} = ${LEAGUE_NAMES[l]}`).join('\n- ');
  const entries = seasons.length * leagues.length;

  return `List every club that played in the top division in each season from ${seasonLabel(decade)} to ${seasonLabel(lastSeason)}, for these leagues:
- ${leagueList}

That is ${entries} league seasons (${seasons.length} seasons × ${leagues.length} ${leagues.length === 1 ? 'league' : 'leagues'}). For each one, list ALL clubs of that season's table — usually 16 to 22. Check the exact number for every season: league sizes changed over the years in all five leagues.

Accuracy:
- Use the final league table of each season (e.g. the Wikipedia "${seasonLabel(decade)} ${LEAGUE_NAMES[leagues[0]]}" article). Include promoted clubs, exclude relegated ones from the season before.
- Use each club's common English name (e.g. "Bayern Munich", "Inter Milan", "Athletic Bilbao", "Saint-Étienne"), spelled the same way in every season.
- Do not guess. Every club must really have played in that league in that season.
- A season in progress: list the clubs taking part.

Reply with only this JSON — no prose, no markdown, no code fence. One entry per league per season, ${entries} entries in total:

{
  "version": 1,
  "source": "<main source, e.g. https://en.wikipedia.org>",
  "seasons": [
    { "league": "${leagues[0]}", "season": ${decade}, "clubs": ["Club A", "Club B", "…"] },
    { "league": "${leagues[0]}", "season": ${decade + 1}, "clubs": ["…"] }
  ]
}

Field rules:
- league: exactly one of ${leagues.join(', ')}
- season: the start year as a number (${decade} means ${seasonLabel(decade)})
- clubs: every club of that season, no duplicates`;
}
