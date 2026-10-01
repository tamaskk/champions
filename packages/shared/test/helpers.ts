import type { MatchPlayer, MatchSide, PlayerRole } from "../src/index";

/** An XI in 4-3-3 where every player has the same rating; forwards score the most. */
export function side(name: string, rating: number, factor = 1): MatchSide {
  const line = (position: PlayerRole, count: number, goals: number): MatchPlayer[] =>
    Array.from({ length: count }, (_, i) => ({
      name: `${name} ${position}${i + 1}`,
      position,
      rating,
      goals,
      appearances: 30,
    }));
  return { name, xi: [...line("GK", 1, 0), ...line("DF", 4, 1), ...line("MF", 3, 4), ...line("FW", 3, 12)], factor };
}
