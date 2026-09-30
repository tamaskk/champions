import { sessionUserId } from "@/server/session";
import { failed, json, preflight, readAuthedJson, rateLimitResponse } from "@/server/cors";
import { BadRequest } from "@/server/leaderboard-data";
import { playTournament } from "@/server/play-data";

export const OPTIONS = preflight;

/** POST /api/squads/:id/play {userId, teamName, mode, …choice} – the server plays the tournament and stores the result. */
export async function POST(request: Request, { params }: RouteContext<"/api/squads/[id]/play">) {
  const limited = await rateLimitResponse("POST /api/squads/:id/play", request, await sessionUserId(request));
  if (limited) return limited;
  try {
    const { body } = await readAuthedJson<never>(request);
    return json(await playTournament((await params).id, body));
  } catch (error) {
    if (error instanceof BadRequest) return json({ error: error.message }, error.status);
    return failed("POST /api/squads/:id/play", error);
  }
}
