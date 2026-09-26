import type { MatchEvent, MatchPlayer, MatchResult } from './match';

/**
 * Head-to-head: random matchmaking between two players who are looking for an opponent at the
 * same time. The server plays the match between both drafted XIs; nobody within the wait time →
 * a squad another player saved on the leaderboard can stand in ("ghost").
 */

/** Your side as the server needs it (ratings already scaled by position fit; chemistry as factor). */
export type H2HSide = {
  username: string;
  overall: number;
  chemistry: number;
  formation: string;
  xi: MatchPlayer[];
  factor: number;
};

/** POST /api/h2h/queue */
export type H2HQueueRequest = { userId: string; side: H2HSide };

export type H2HMatched = {
  status: 'matched';
  ticketId: string;
  opponent: {
    username: string;
    overall: number;
    chemistry: number;
    formation: string;
    xi: MatchPlayer[];
    /** No live player came: another player's saved squad stood in. */
    ghost?: boolean;
  };
  youAtHome: boolean;
  result: MatchResult;
  events: MatchEvent[];
};

/** Waiting for an opponent, expired, or matched (the match from your point of view). */
export type H2HTicket =
  | { status: 'waiting'; ticketId: string; since: string }
  | { status: 'expired'; ticketId: string }
  | H2HMatched;

/** Seconds a player waits in the queue before the ticket expires. */
export const H2H_WAIT_SECONDS = 90;
