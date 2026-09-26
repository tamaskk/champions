import {
  DECADES,
  type DailyResponse,
  type H2HQueueRequest,
  type H2HTicket,
  type LeaderboardResponse,
  type LegendResponse,
  type LegendsAvailability,
  type SaveSquadRequest,
  type SquadDetail,
  type SquadResult,
  type UserResponse,
  LEAGUE_ADJECTIVES,
  decadeLabel,
  type ClubsResponse,
  type CupFieldResponse,
  type League,
  type LeagueTableResponse,
  type OpponentResponse,
  type SeasonXIsResponse,
  type PlayerCareer,
  type SquadResponse,
  type ClaimResponse,
  type ClaimSource,
  type SpendResponse,
  type WalletResponse,
} from '@champion/shared';
import Constants from 'expo-constants';

import type { DraftPlayer } from '@/mocks/players';

/**
 * EXPO_PUBLIC_API_URL wins. Otherwise use the machine running the Expo dev server (so a phone on
 * the same wifi reaches the Mac's Next server) on EXPO_PUBLIC_API_PORT, default 3100 — the fixed
 * port of `pnpm dev:web`.
 */
function apiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:${process.env.EXPO_PUBLIC_API_PORT ?? '3100'}`;
}

const leagueFromLabel = (label: string) =>
  (Object.keys(LEAGUE_ADJECTIVES) as League[]).find((l) => LEAGUE_ADJECTIVES[l] === label);
const decadeFromLabel = (label: string) => DECADES.find((d) => decadeLabel(d) === label);

/** Clubs imported for a league in a decade, using the reel labels ("German", "70"). */
export async function fetchClubs(leagueLabel: string, decadeLabelText: string): Promise<ClubsResponse> {
  const league = leagueFromLabel(leagueLabel);
  const decade = decadeFromLabel(decadeLabelText);
  if (!league || !decade) throw new Error(`Unknown league/decade: ${leagueLabel} ${decadeLabelText}`);

  const res = await fetch(`${apiBaseUrl()}/api/clubs?league=${league}&decade=${decade}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/** A club's imported players across the spun decade (club by name; the API slugifies it). */
export async function fetchSquad(leagueLabel: string, decadeLabelText: string, club: string): Promise<SquadResponse> {
  const league = leagueFromLabel(leagueLabel);
  const decade = decadeFromLabel(decadeLabelText);
  if (!league || !decade) throw new Error(`Unknown league/decade: ${leagueLabel} ${decadeLabelText}`);

  const query = `league=${league}&decade=${decade}&club=${encodeURIComponent(club)}`;
  const res = await fetch(`${apiBaseUrl()}/api/squad?${query}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/** An API squad player as offered in the draft list. */
export function toDraftPlayer(p: SquadResponse['players'][number]): DraftPlayer {
  return {
    id: p.nameSlug,
    name: p.name,
    position: p.position,
    rating: p.rating ?? undefined,
    positions: p.positions,
    chemistry: p.chemistry,
    goals: p.goals,
    appearances: p.appearances,
    tmId: p.tmPlayerId,
    detail: [
      p.positions.join('/'),
      p.nationality,
      p.appearances !== null && `${p.appearances} apps`,
      p.goals !== null && `${p.goals} goals`,
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

/** Final table of a league season, or of a random completed one (`random`). */
export async function fetchTable(
  query: { random: true } | { league: League; season: number },
): Promise<LeagueTableResponse> {
  const qs = 'random' in query ? 'random=1' : `league=${query.league}&season=${query.season}`;
  const res = await fetch(`${apiBaseUrl()}/api/table?${qs}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/** A real club season's likely XI with season ratings (Match mode opponent). */
export async function fetchOpponent(query: {
  league: League;
  season: number;
  club: string;
}): Promise<OpponentResponse> {
  const qs = `league=${query.league}&season=${query.season}&club=${encodeURIComponent(query.club)}`;
  const res = await fetch(`${apiBaseUrl()}/api/opponent?${qs}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/** Every club's likely XI in a league season (League simulation). */
export async function fetchSeasonXIs(query: { league: League; season: number }): Promise<SeasonXIsResponse> {
  const res = await fetch(`${apiBaseUrl()}/api/season-xis?league=${query.league}&season=${query.season}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/** Champions League field of a season: the 31 strongest clubs of the top five leagues. */
export async function fetchCupField(season: number): Promise<CupFieldResponse> {
  const res = await fetch(`${apiBaseUrl()}/api/cl-field?season=${season}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ---- Leaderboard

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBaseUrl()}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/** A new player with a generated username. */
export const createUser = () => postJSON<UserResponse>('/api/users', {});
/** Saves a squad on the leaderboard. */
export const saveSquad = (body: SaveSquadRequest) => postJSON<{ id: string }>('/api/squads', body);
/** Adds a tournament result to a saved squad. */
export const postSquadResult = (id: string, userId: string, result: Omit<SquadResult, 'at'>) =>
  postJSON<{ ok: true }>(`/api/squads/${id}/result`, { userId, result });
/** Highest-overall squads (all time or this week). */
export const fetchLeaderboard = (period: 'all' | 'week' = 'all') =>
  getJSON<LeaderboardResponse>(`/api/squads?limit=50&period=${period}`);
/** One saved squad: XI and results. */
export const fetchSquadDetail = (id: string) => getJSON<SquadDetail>(`/api/squads/${encodeURIComponent(id)}`);

// ---- Legends

/** A legendary club season's likely XI. */
export const fetchLegend = (id: string) => getJSON<LegendResponse>(`/api/legend?id=${encodeURIComponent(id)}`);
/** Legends whose squad is in the database. */
export const fetchLegendsAvailability = () => getJSON<LegendsAvailability>('/api/legends');

// ---- Daily challenge

/** The day's challenge (scheduled in the admin, or from the built-in pool). */
export const fetchDaily = (date: string) => getJSON<DailyResponse>(`/api/daily?date=${date}`);

// ---- Head-to-head

/** Joins the matchmaking queue with your XI. */
export const h2hQueue = (body: H2HQueueRequest) => postJSON<H2HTicket>('/api/h2h/queue', body);
/** Polls a queue ticket. */
export const h2hTicket = (id: string, userId: string) =>
  getJSON<H2HTicket>(`/api/h2h/ticket/${id}?userId=${encodeURIComponent(userId)}`);
/** Nobody came: play another player's saved squad instead. */
export const h2hGhost = (id: string, userId: string) => postJSON<H2HTicket>(`/api/h2h/ticket/${id}/ghost`, { userId });

/** A player's career season by season (player card). Real players only. */
export async function fetchPlayerCareer(player: { tmId?: number | null; name: string }): Promise<PlayerCareer> {
  const query = player.tmId ? `tm=${player.tmId}` : `name=${encodeURIComponent(player.name)}`;
  const res = await fetch(`${apiBaseUrl()}/api/player?${query}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ---- Sharing

/** Public web page of a saved squad (the share link; it opens the XI and the app to challenge it). */
export const squadShareUrl = (id: string) => `${apiBaseUrl()}/s/${id}`;

// ---- Wallet (coins live on the server; see apps/web/src/server/wallet-data.ts)

export const fetchWallet = (userId: string) => postJSON<WalletResponse>('/api/wallet', { userId });
export const claimCoins = (userId: string, source: ClaimSource, key: string) =>
  postJSON<ClaimResponse>('/api/wallet/claim', { userId, source, key });
export const buyStoreItem = (userId: string, itemId: string, requestId: string) =>
  postJSON<SpendResponse>('/api/wallet/buy', { userId, itemId, requestId });
export const consumeStoreItem = (userId: string, itemId: string, requestId: string) =>
  postJSON<SpendResponse>('/api/wallet/use', { userId, itemId, requestId });
export const redeemInviteCode = (userId: string, code: string) =>
  postJSON<ClaimResponse>('/api/wallet/invite', { userId, code });
export const renameUser = (userId: string, username: string, requestId: string) =>
  postJSON<SpendResponse>('/api/wallet/rename', { userId, username, requestId });
/** Development only: the server credits the product as if the app store had confirmed it. */
export const simulatePurchase = (userId: string, productId: string, requestId: string) =>
  postJSON<WalletResponse>('/api/wallet/simulate-purchase', { userId, productId, requestId });
