import type { LeaderboardResponse, SaveSquadRequest } from "@champion/shared";
import type { NextRequest } from "next/server";

import { failed, json, preflight, rateLimitResponse, readAuthedJson } from "@/server/cors";
import { BadRequest, leaderboard, saveSquad } from "@/server/leaderboard-data";

export const OPTIONS = preflight;

/** GET /api/squads?limit=50&period=all|week – the leaderboard, highest overall first. */
export async function GET(request: NextRequest) {
  const limited = await rateLimitResponse("GET /api/squads", request, null);
  if (limited) return limited;
  const params = request.nextUrl.searchParams;
  const limit = Number(params.get("limit")) || 50;
  const period = params.get("period") === "week" ? "week" : "all";
  try {
    return json({ squads: await leaderboard(limit, period) } satisfies LeaderboardResponse);
  } catch (error) {
    return failed("GET /api/squads", error);
  }
}

/** POST /api/squads (signed in) – save a squad under the player's username (listed or not). */
export async function POST(request: NextRequest) {
  try {
    // userId comes from the session token, never from the body.
    const { body, auth } = await readAuthedJson<SaveSquadRequest>(request);
    const limited = await rateLimitResponse("POST /api/squads", request, auth.userId);
    if (limited) return limited;
    return json(await saveSquad(body));
  } catch (error) {
    if (error instanceof BadRequest) return json({ error: error.message }, error.status);
    return failed("POST /api/squads", error);
  }
}
