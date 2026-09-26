import type { LeaderboardResponse, SaveSquadRequest } from "@champion/shared";
import type { NextRequest } from "next/server";

import { failed, json, preflight, readJson } from "@/server/cors";
import { BadRequest, leaderboard, saveSquad } from "@/server/leaderboard-data";

export const OPTIONS = preflight;

/** GET /api/squads?limit=50&period=all|week – the leaderboard, highest overall first. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const limit = Number(params.get("limit")) || 50;
  const period = params.get("period") === "week" ? "week" : "all";
  try {
    return json({ squads: await leaderboard(limit, period) } satisfies LeaderboardResponse);
  } catch (error) {
    return failed("GET /api/squads", error);
  }
}

/** POST /api/squads – save a squad on the leaderboard under the player's username. */
export async function POST(request: NextRequest) {
  try {
    return json(await saveSquad(await readJson<SaveSquadRequest>(request)));
  } catch (error) {
    if (error instanceof BadRequest) return json({ error: error.message }, 400);
    return failed("POST /api/squads", error);
  }
}
