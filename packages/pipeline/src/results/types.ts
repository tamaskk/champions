/** Leagues whose results we rate. NED is not in the game, it only adds links through European cups. */
export const RATED_LEAGUES = ["ENG", "ESP", "ITA", "GER", "FRA", "NED"] as const;
export type RatedLeague = (typeof RATED_LEAGUES)[number];

export const isRatedLeague = (c: string): c is RatedLeague => (RATED_LEAGUES as readonly string[]).includes(c);

/** One played match, as read from a source file, before team names are resolved. */
export type RawMatch = {
  /** YYYY-MM-DD */
  date: string;
  /** Season start year. */
  season: number;
  /** A league code for top-flight league matches, "EUR" for European cup matches. */
  comp: RatedLeague | "EUR";
  home: string;
  away: string;
  /** Country codes (ENG, ESP, …). For league matches both equal the league. */
  homeCountry: string;
  awayCountry: string;
  /** Final score incl. extra time; a penalty shoot-out counts as the draw it was. */
  homeGoals: number;
  awayGoals: number;
  /** Cup finals are played at a neutral ground: no home advantage. */
  neutral: boolean;
};
