import { postHandler, preflight } from "@/server/cors";
import { miniLeagueDetail } from "@/server/mini-league-data";

export const OPTIONS = preflight;

/** POST /api/leagues/detail {userId, id, week?} – the week's Daily table of one mini-league. */
export const POST = postHandler("POST /api/leagues/detail", miniLeagueDetail);
