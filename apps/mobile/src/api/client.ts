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
  type AuthProfile,
  type LoginRequest,
  type RegisterRequest,
  type SearchResponse,
  type DailyScoreRequest,
  type DailyScoreResponse,
  type MiniLeagueDetail,
  type MiniLeaguesResponse,
  type PlayRequest,
  type PlayResponse,
  type SecondChanceResponse,
} from '@champion/shared';
import Constants from 'expo-constants';

import type { DraftPlayer } from '@/mocks/players';

/** The live backend (Vercel). */
const PRODUCTION_API_URL = 'https://champions-web-amber.vercel.app';

/**
 * Where the app finds the API:
 *  - EXPO_PUBLIC_API_URL, if set (any server);
 *  - EXPO_PUBLIC_API_LOCAL=1: the Mac running the Expo dev server, on EXPO_PUBLIC_API_PORT
 *    (default 3100 = `pnpm dev:web`), so a phone on the same wifi reaches the local Next server;
 *  - otherwise the live backend.
 */
function apiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  if (process.env.EXPO_PUBLIC_API_LOCAL === '1') {
    const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
    return `http://${host}:${process.env.EXPO_PUBLIC_API_PORT ?? '3100'}`;
  }
  return PRODUCTION_API_URL;
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

/** Like postJSON, but a 400 throws the server's message (shown to the player, e.g. "That league is full"). */
async function postJSONMessage<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) throw new Error(res.status === 400 && data?.error ? data.error : 'No connection to the server');
  return data;
}

// ---- Daily scores and mini-leagues (friends' groups)
/** Your official result of a day's Daily (the server recomputes the score). */
export const submitDailyScore = (body: DailyScoreRequest) => postJSON<DailyScoreResponse>('/api/daily/score', body);
export const fetchMiniLeagues = (userId: string) => postJSONMessage<MiniLeaguesResponse>('/api/leagues', { userId });
export const createMiniLeague = (userId: string, name: string) =>
  postJSONMessage<MiniLeaguesResponse>('/api/leagues/create', { userId, name });
export const joinMiniLeague = (userId: string, code: string) =>
  postJSONMessage<MiniLeaguesResponse>('/api/leagues/join', { userId, code });
export const leaveMiniLeague = (userId: string, id: string) =>
  postJSONMessage<MiniLeaguesResponse>('/api/leagues/leave', { userId, id });
export const fetchMiniLeague = (userId: string, id: string, week?: string) =>
  postJSONMessage<MiniLeagueDetail>('/api/leagues/detail', { userId, id, week });

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
/** The server plays a tournament with the saved squad and stores the result (see PlayRequest). */
export const playTournament = (squadId: string, body: PlayRequest) =>
  postJSONMessage<PlayResponse>(`/api/squads/${squadId}/play`, body);
/** Uses a Second chance on the server: the squad may play one more tournament. */
export const secondChanceRequest = (squadId: string, userId: string, requestId: string) =>
  postJSONMessage<SecondChanceResponse>(`/api/squads/${squadId}/second-chance`, { userId, requestId });
/** Puts a squad saved only to play onto the leaderboard. */
export const listSquadRequest = (squadId: string, userId: string) =>
  postJSONMessage<{ ok: true }>(`/api/squads/${squadId}/list`, { userId });
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
/** A page of the website (privacy policy, terms, support). */
export const webPageUrl = (path: '/privacy' | '/terms' | '/support') => `${apiBaseUrl()}${path}`;

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

// ---- Accounts (email + password on top of the guest user)

export const registerAccount = (body: RegisterRequest) =>
  postJSON<AuthProfile | { errors: Record<string, string> } | { error: string }>('/api/auth/register', body);
export const loginAccount = (body: LoginRequest) => postJSON<AuthProfile | { error: string }>('/api/auth/login', body);
export const fetchProfile = (userId: string) => postJSON<AuthProfile>('/api/auth/me', { userId });
export const changeAccountPassword = (userId: string, oldPassword: string, newPassword: string) =>
  postJSON<{ ok: boolean; error?: string }>('/api/auth/password', { userId, oldPassword, newPassword });
/** Emails a 6-digit code to set a new password. */
export const requestPasswordReset = (email: string) =>
  postJSON<{ ok: boolean; error?: string }>('/api/auth/forgot', { email });
/** New password with the emailed code or the account's backup code; logs in on success. */
export const resetPasswordRequest = (body: { email: string; code?: string; backupCode?: string; newPassword: string }) =>
  postJSON<AuthProfile | { error: string }>('/api/auth/reset', body);
/** Deletes the account and all its data on the server (password required for registered accounts). */
export const deleteAccountRequest = (userId: string, password?: string) =>
  postJSON<{ ok: boolean; error?: string }>('/api/auth/delete', { userId, password });

// ---- Search (Explore)

/** Players and clubs by name; accents don't matter ("mbappe", "koln"). */
export async function fetchSearch(q: string): Promise<SearchResponse> {
  const res = await fetch(`${apiBaseUrl()}/api/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/** A club's players in a decade, by league code and decade start year (search results). */
export async function fetchSquadByCode(league: League, decade: number, club: string): Promise<SquadResponse> {
  const res = await fetch(`${apiBaseUrl()}/api/squad?league=${league}&decade=${decade}&club=${encodeURIComponent(club)}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}
