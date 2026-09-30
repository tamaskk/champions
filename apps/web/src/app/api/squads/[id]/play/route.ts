import { failed, json, preflight, readJson } from "@/server/cors";
import { BadRequest } from "@/server/leaderboard-data";
import { playTournament } from "@/server/play-data";

export const OPTIONS = preflight;

/** POST /api/squads/:id/play {userId, teamName, mode, …choice} – the server plays the tournament and stores the result. */
export async function POST(request: Request, { params }: RouteContext<"/api/squads/[id]/play">) {
  try {
    return json(await playTournament((await params).id, await readJson(request)));
  } catch (error) {
    if (error instanceof BadRequest) return json({ error: error.message }, 400);
    return failed("POST /api/squads/:id/play", error);
  }
}
