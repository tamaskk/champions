import { postHandler, preflight } from "@/server/cors";
import { leaveMiniLeague } from "@/server/mini-league-data";

export const OPTIONS = preflight;

/** POST /api/leagues/leave {userId, id} – leave a mini-league. */
export const POST = postHandler("POST /api/leagues/leave", leaveMiniLeague);
