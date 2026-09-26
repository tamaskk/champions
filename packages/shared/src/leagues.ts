export const LEAGUES = ['ENG', 'ESP', 'ITA', 'GER', 'FRA'] as const;
export type League = (typeof LEAGUES)[number];

export const LEAGUE_NAMES: Record<League, string> = {
  ENG: 'Premier League / First Division',
  ESP: 'La Liga',
  ITA: 'Serie A',
  GER: 'Bundesliga',
  FRA: 'Ligue 1 / Division 1',
};

/** Nationality-style label, in the order shown on the league reel. */
export const LEAGUE_ADJECTIVES = {
  ESP: 'Spanish',
  ITA: 'Italian',
  ENG: 'English',
  GER: 'German',
  FRA: 'French',
} as const satisfies Record<League, string>;

export const DECADES = [1960, 1970, 1980, 1990, 2000, 2010, 2020] as const;
export type Decade = (typeof DECADES)[number];

/** Short decade label: 1960 -> "60", 2000 -> "00". */
export const decadeLabel = (decade: Decade) => String(decade).slice(2);
