import { postHandler, preflight } from "@/server/cors";
import { submitDailyScore } from "@/server/mini-league-data";

export const OPTIONS = preflight;

/** POST /api/daily/score {userId, date, challengeId, outcome} – your official Daily result (score recomputed here). */
export const POST = postHandler("POST /api/daily/score", submitDailyScore);
