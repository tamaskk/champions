import { postHandler, preflight } from "@/server/cors";
import { joinMiniLeague } from "@/server/mini-league-data";

export const OPTIONS = preflight;

/** POST /api/leagues/join {userId, code} – join a friend's mini-league. */
export const POST = postHandler("POST /api/leagues/join", joinMiniLeague);
