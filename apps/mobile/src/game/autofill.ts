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

const LEAGUE_LABELS = Object.values(LEAGUE_ADJECTIVES);
const DECADE_LABELS = DECADES.map(decadeLabel);
// Random club-decades to try per spot before giving up on it.
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

/** The filled slots, and how many stayed empty (no fitting player found, or offline). */
export type Autofill = { picks: (DraftPick | null)[]; missing: number };

/**
 * Fills each empty slot with a real player: up to ATTEMPTS_PER_SPOT random draws per slot. A slot
 * no draw fills stays empty (never a made-up player); once the API is unreachable the rest stay
 * empty too. `isCancelled` stops the work when the game was closed meanwhile.
 */
async function fillSlots(
  slots: (DraftPick | null)[],
  spotFor: (i: number) => Spot,
  taken: Set<string>,
  isCancelled: () => boolean,
): Promise<Autofill | null> {
  const picks = [...slots];
  let offline = false;
  for (let i = 0; i < picks.length; i++) {
    if (picks[i]) continue;
    for (let attempt = 0; attempt < ATTEMPTS_PER_SPOT && !picks[i] && !offline; attempt++) {
      if (isCancelled()) return null;
      try {
        picks[i] = await drawForSpot(spotFor(i), taken);
      } catch {
        offline = true; // no point retrying
      }
    }
    if (picks[i]) taken.add(picks[i]!.player.name);
  }
  return { picks, missing: picks.filter((p) => !p).length };
}

/** Fills every empty spot of the lineup; null when cancelled. */
export function autofillLineup(
  spots: Spot[],
  lineup: (DraftPick | null)[],
  isCancelled: () => boolean,
): Promise<Autofill | null> {
  const taken = new Set(lineup.flatMap((p) => (p ? [p.player.name] : [])));
  return fillSlots(lineup, (i) => spots[i], taken, isCancelled);
}

/** What Autocomplete puts on an empty bench: cover for every line. */
const BENCH_PLAN: Spot[] = [
  { code: 'GK', role: 'GK' },
  { code: 'CB', role: 'DF' },
  { code: 'CM', role: 'MF' },
  { code: 'CF', role: 'FW' },
  { code: 'CM', role: 'MF' },
];

/** Fills every empty bench slot the same way, avoiding anyone already in `lineup` or on the bench; null when cancelled. */
export function autofillBench(
  bench: (DraftPick | null)[],
  lineup: (DraftPick | null)[],
  isCancelled: () => boolean,
): Promise<Autofill | null> {
  const taken = new Set([...lineup, ...bench].flatMap((p) => (p ? [p.player.name] : [])));
  return fillSlots(bench, (i) => BENCH_PLAN[i % BENCH_PLAN.length], taken, isCancelled);
}
