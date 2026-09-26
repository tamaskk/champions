import {
  DECADES,
  LEAGUE_ADJECTIVES,
  decadeLabel,
  positionFit,
  type PlayerRole,
  type PositionCode,
} from '@champion/shared';

import { fetchClubs, fetchSquad, toDraftPlayer } from '@/api/client';
import type { DraftPick } from '@/components/draft-spin';
import { randomPlayers } from '@/mocks/players';

const LEAGUE_LABELS = Object.values(LEAGUE_ADJECTIVES);
const DECADE_LABELS = DECADES.map(decadeLabel);
// Random club-decades to try per spot before falling back to a dummy player.
const ATTEMPTS_PER_SPOT = 8;

const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

type Spot = { code: PositionCode; role: PlayerRole };

/**
 * One draw by the game's rules for one spot: random decade, league and club (from the imported
 * clubs), then a random player from that squad who fits the spot, main position preferred.
 */
async function drawForSpot(spot: Spot, taken: Set<string>): Promise<DraftPick | null> {
  const decade = pick(DECADE_LABELS);
  const league = pick(LEAGUE_LABELS);
  const { clubs } = await fetchClubs(league, decade);
  if (clubs.length === 0) return null;
  const club = pick(clubs).club;
  const { players } = await fetchSquad(league, decade, club);

  const candidates = players.map(toDraftPlayer).filter((p) => !taken.has(p.name));
  const main = candidates.filter((p) => positionFit(p, spot) === 'main');
  const other = candidates.filter((p) => positionFit(p, spot) === 'other');
  const player = main.length ? pick(main) : other.length ? pick(other) : null;
  return player && { player, league, club, decade };
}

function dummyForSpot(spot: Spot, taken: Set<string>): DraftPick {
  const league = pick(LEAGUE_LABELS);
  const player =
    randomPlayers(league).find((p) => p.position === spot.role && !taken.has(p.name)) ??
    randomPlayers(league).filter((p) => p.position === spot.role)[0];
  return { player, league, club: 'Demo club', decade: pick(DECADE_LABELS) };
}

/**
 * Fills every empty spot of the lineup. Each spot gets up to ATTEMPTS_PER_SPOT random draws; if
 * none yields a fitting player (or the API is unreachable), a dummy player takes the spot.
 * `isCancelled` stops the work when the game was closed meanwhile.
 */
export async function autofillLineup(
  spots: Spot[],
  lineup: (DraftPick | null)[],
  isCancelled: () => boolean,
): Promise<(DraftPick | null)[]> {
  const next = [...lineup];
  const taken = new Set(next.flatMap((p) => (p ? [p.player.name] : [])));

  for (let i = 0; i < spots.length; i++) {
    if (next[i]) continue;
    let chosen: DraftPick | null = null;
    for (let attempt = 0; attempt < ATTEMPTS_PER_SPOT && !chosen; attempt++) {
      if (isCancelled()) return lineup;
      try {
        chosen = await drawForSpot(spots[i], taken);
      } catch {
        break; // offline: no point retrying
      }
    }
    chosen ??= dummyForSpot(spots[i], taken);
    next[i] = chosen;
    taken.add(chosen.player.name);
  }
  return next;
}

/** What Autocomplete puts on an empty bench: cover for every line. */
const BENCH_PLAN: Spot[] = [
  { code: 'GK', role: 'GK' },
  { code: 'CB', role: 'DF' },
  { code: 'CM', role: 'MF' },
  { code: 'CF', role: 'FW' },
  { code: 'CM', role: 'MF' },
];

/** Fills every empty bench slot the same way, avoiding anyone already in `lineup` or on the bench. */
export async function autofillBench(
  bench: (DraftPick | null)[],
  lineup: (DraftPick | null)[],
  isCancelled: () => boolean,
): Promise<(DraftPick | null)[]> {
  const next = [...bench];
  const taken = new Set([...lineup, ...bench].flatMap((p) => (p ? [p.player.name] : [])));
  for (let i = 0; i < next.length; i++) {
    if (next[i]) continue;
    const spot = BENCH_PLAN[i % BENCH_PLAN.length];
    let chosen: DraftPick | null = null;
    for (let attempt = 0; attempt < ATTEMPTS_PER_SPOT && !chosen; attempt++) {
      if (isCancelled()) return bench;
      try {
        chosen = await drawForSpot(spot, taken);
      } catch {
        break;
      }
    }
    chosen ??= dummyForSpot(spot, taken);
    next[i] = chosen;
    taken.add(chosen.player.name);
  }
  return next;
}
