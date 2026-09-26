import { seasonLabel, slugify } from "./clubs";
import type { ChemistryProfile } from "./chemistry";
import { PLAYER_ROLES, type PlayerRole } from "./formation-layout";
import { LEAGUE_NAMES, type League } from "./leagues";

/** A player in a club's squad for one season. */
export type SquadPlayer = {
  league: League;
  season: number;
  clubSlug: string;
  name: string;
  nameSlug: string;
  position: PlayerRole;
  nationality: string | null;
  birthYear: number | null;
  appearances: number | null;
  goals: number | null;
  source: string | null;
  // Optional detail, set by pipeline imports (Transfermarkt). All league-only, that season.
  // A stat is null when the source has no data for that era (e.g. assists and cards before
  // the 1990s), which is different from 0.
  assists?: number | null;
  /** For old seasons Transfermarkt estimates minutes (appearances × 90). */
  minutes?: number | null;
  /** Matchday squad call-ups. */
  inSquad?: number | null;
  subsOn?: number | null;
  subsOff?: number | null;
  yellowCards?: number | null;
  secondYellowCards?: number | null;
  redCards?: number | null;
  /** Goalkeepers only (tm:keepers): league matches without conceding. */
  cleanSheets?: number | null;
  /** Goalkeepers only (tm:keepers): league goals conceded. */
  goalsConceded?: number | null;
  /** true when the keeper played for two clubs that season and his totals were split by appearances. */
  keeperStatsEstimated?: boolean;
  /** Team points per game in the matches the player played. */
  pointsPerGame?: number | null;
  /** Age during that season, as the source shows it. */
  age?: number | null;
  /** Detailed position, e.g. "Centre-Back", "Left Winger". */
  detailedPosition?: string | null;
  /** Every nationality as a code, primary first (nationality = the first one). */
  nationalities?: string[];
  /** Transfermarkt player id: stable across clubs and seasons, so it links the same player. */
  tmPlayerId?: number | null;
  /** Career main position as Transfermarkt's profile shows it, e.g. "Centre-Forward" (tm:positions). */
  mainPosition?: string | null;
  /** Other positions from the profile, e.g. ["Left Winger", "Right Winger"]. */
  otherPositions?: string[];
  /** All of them as short codes, main first: ["CF", "LW", "RW"]. */
  positions?: string[];
  /** 0–100 for this season (pipeline: rate; Messi 2011/12 = 100). */
  rating?: number | null;
  /** 0–100 for picking him from this club decade: 0.7 × best + 0.3 × second best season there. */
  decadeRating?: number | null;
};

/** Shape of a squad import (pasted JSON or the local Claude CLI's answer). */
export type SquadImportFile = {
  version: 1;
  source?: string;
  players: {
    name: string;
    position: PlayerRole;
    nationality?: string | null;
    birthYear?: number | null;
    appearances?: number | null;
    goals?: number | null;
  }[];
};

export type SquadImportError = { path: string; message: string };

export type SquadParseResult = {
  players: SquadPlayer[];
  errors: SquadImportError[];
  duplicates: number;
};

export type SquadTarget = {
  league: League;
  season: number;
  clubSlug: string;
  club: string;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function optionalCount(
  value: unknown,
  path: string,
  errors: SquadImportError[],
  max: number,
): number | null {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > max
  ) {
    errors.push({
      path,
      message: `Must be a whole number between 0 and ${max}, or null`,
    });
    return null;
  }
  return value;
}

/** Validates a squad file and attaches every player to `target`. Collects all problems. */
export function parseSquadImport(
  input: unknown,
  target: SquadTarget,
): SquadParseResult {
  const players: SquadPlayer[] = [];
  const errors: SquadImportError[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  if (!isRecord(input)) {
    return {
      players,
      errors: [{ path: "$", message: "Top level must be an object" }],
      duplicates,
    };
  }
  if (input.version !== 1)
    errors.push({ path: "version", message: "Must be 1" });
  if (!Array.isArray(input.players)) {
    errors.push({ path: "players", message: "Must be an array" });
    return { players, errors, duplicates };
  }
  // Chat UIs often turn URLs into markdown links: "[https://x](https://x)" -> "https://x".
  const rawSource = typeof input.source === "string" ? input.source.trim() : "";
  const source = rawSource.replace(/^\[([^\]]*)\]\(([^)]*)\)$/, "$2") || null;

  input.players.forEach((entry, i) => {
    const at = `players[${i}]`;
    if (!isRecord(entry))
      return errors.push({ path: at, message: "Must be an object" });

    const name =
      typeof entry.name === "string"
        ? entry.name.trim().replace(/\s+/g, " ")
        : "";
    if (!slugify(name))
      errors.push({ path: `${at}.name`, message: "Must be a non-empty name" });

    const position = entry.position as PlayerRole;
    if (!PLAYER_ROLES.includes(position)) {
      errors.push({
        path: `${at}.position`,
        message: `Must be one of ${PLAYER_ROLES.join(", ")}`,
      });
    }

    const nationality =
      typeof entry.nationality === "string" && entry.nationality.trim()
        ? entry.nationality.trim()
        : null;
    const birthYear = optionalCount(
      entry.birthYear,
      `${at}.birthYear`,
      errors,
      target.season,
    );
    const appearances = optionalCount(
      entry.appearances,
      `${at}.appearances`,
      errors,
      100,
    );
    const goals = optionalCount(entry.goals, `${at}.goals`, errors, 100);

    if (!slugify(name) || !PLAYER_ROLES.includes(position)) return;
    const nameSlug = slugify(name);
    if (seen.has(nameSlug)) return duplicates++;
    seen.add(nameSlug);

    players.push({
      league: target.league,
      season: target.season,
      clubSlug: target.clubSlug,
      name,
      nameSlug,
      position,
      nationality,
      birthYear,
      appearances,
      goals,
      source,
    });
  });

  return { players, errors, duplicates };
}

/** JSON Schema of SquadImportFile, for LLMs that support structured output. */
export const SQUAD_IMPORT_SCHEMA = {
  type: "object",
  properties: {
    version: { const: 1 },
    source: { type: "string", description: "Main source(s) used, e.g. a URL" },
    players: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          position: { enum: [...PLAYER_ROLES] },
          nationality: {
            type: ["string", "null"],
            description: "ISO 3166 alpha-3 country code",
          },
          birthYear: { type: ["integer", "null"] },
          appearances: {
            type: ["integer", "null"],
            description: "League appearances that season",
          },
          goals: {
            type: ["integer", "null"],
            description: "League goals that season",
          },
        },
        required: [
          "name",
          "position",
          "nationality",
          "birthYear",
          "appearances",
          "goals",
        ],
      },
    },
  },
  required: ["version", "source", "players"],
} as const;

/** Prompt that asks an LLM for a squad in SquadImportFile format. */
export function buildSquadPrompt(target: SquadTarget): string {
  const season = seasonLabel(target.season);
  const ongoing =
    target.season >=
    new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0);
  return `Give me the COMPLETE first-team squad full squad of ${target.club} for the ${season} ${LEAGUE_NAMES[target.league]} season.

I need the full, deep squad — every player registered with the first team that season, not just the regulars:
- ALL goalkeepers, including second and third choice (a squad almost always has 3 or more)
- players with 0 league appearances (backups, injured players, youth players promoted to the first team)
- players who joined or left during the season (winter transfers, loans in and out)
- a typical squad has 30 to 50 players; if you have fewer than 30, keep searching

Accuracy:
- Every player must really have been in ${target.club}'s squad in ${season}. Double-check each name against the squad list; never add players from other clubs.
- Use reliable sources: the "${season} ${target.club} season" Wikipedia article (squad section), worldfootball.net or transfermarkt squad pages, fbref.com, historical-lineups.com. Cross-check at least two.
- Do not invent numbers. If a value is unknown, use null.${
    ongoing
      ? `\n- ${season} may still be in progress: give appearances and goals so far, and still list the whole registered squad.`
      : ""
  }

Reply with only this JSON — no prose, no markdown, no code fence, plain URL in "source":

{
  "version": 1,
  "source": "https://…",
  "players": [
    { "name": "Full Name", "position": "GK", "nationality": "GER", "birthYear": 1944, "appearances": 34, "goals": 0 }
  ]
}

Field rules:
- position: exactly one of GK, DF, MF, FW (goalkeeper, defender, midfielder, forward) — the player's main role that season
- nationality: ISO 3166 alpha-3 code (ENG, GER, ITA, ESP, FRA, NED, BRA, …)
- appearances and goals: league matches only, for ${season}; 0 if the player was in the squad but did not play
- one entry per player, no duplicates`;
}

/** GET /api/squad?league=ENG&decade=2020&club=arsenal — a club's players across a decade. */
export type SquadResponse = {
  league: League;
  decade: number;
  clubSlug: string;
  players: {
    name: string;
    nameSlug: string;
    position: PlayerRole;
    nationality: string | null;
    /** Seasons in the decade the player was in the squad. */
    seasons: number[];
    appearances: number | null;
    goals: number | null;
    /** Rating for picking the player from this club decade (0–100), see pipeline decadeRatings. */
    rating: number | null;
    /** Detailed positions (PositionCode), main first; empty when unknown. */
    positions: string[];
    /** Transfermarkt player id: the same player across clubs and decades. */
    tmPlayerId: number | null;
    /** His whole career (clubs + seasons, nationalities) for computing chemistry on the device. */
    chemistry: ChemistryProfile | null;
  }[];
};

/** GET /api/player?tm=502821 (or ?name=riccardo-calafiori) — a player's career, season by season. */
export type PlayerCareer = {
  name: string;
  nationality: string | null;
  birthYear: number | null;
  positions: string[];
  seasons: {
    league: League;
    season: number;
    clubSlug: string;
    club: string;
    position: PlayerRole;
    appearances: number | null;
    goals: number | null;
    /** Season rating 0–100. */
    rating: number | null;
  }[];
};

/** GET /api/search?q=mbappe – players and clubs whose name matches (accents ignored). */
export type SearchResponse = {
  players: {
    name: string;
    nameSlug: string;
    tmPlayerId: number | null;
    position: PlayerRole;
    positions: string[];
    nationality: string | null;
    /** Best club-decade rating of his career. */
    rating: number | null;
    seasons: number;
    /** Latest club (display name) and its league. */
    club: string;
    league: League;
    from: number;
    to: number;
  }[];
  clubs: {
    club: string;
    clubSlug: string;
    leagues: League[];
    decades: number[];
    from: number;
    to: number;
  }[];
};
