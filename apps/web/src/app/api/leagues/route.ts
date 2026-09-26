import { postHandler, preflight } from "@/server/cors";
import { myMiniLeagues } from "@/server/mini-league-data";

export const OPTIONS = preflight;

/** POST /api/leagues {userId} – your mini-leagues with your place this week. */
export const POST = postHandler("POST /api/leagues", myMiniLeagues);
