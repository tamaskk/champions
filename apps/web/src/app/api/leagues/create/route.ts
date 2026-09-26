import { postHandler, preflight } from "@/server/cors";
import { createMiniLeague } from "@/server/mini-league-data";

export const OPTIONS = preflight;

/** POST /api/leagues/create {userId, name} – a new mini-league with an invite code. */
export const POST = postHandler("POST /api/leagues/create", createMiniLeague);
