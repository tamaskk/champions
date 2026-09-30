import { failed, json, preflight, readJson } from "@/server/cors";
import { BadRequest } from "@/server/leaderboard-data";
import { listSquad } from "@/server/play-data";

export const OPTIONS = preflight;

/** POST /api/squads/:id/list {userId} – puts a squad saved only to play onto the leaderboard. */
export async function POST(request: Request, { params }: RouteContext<"/api/squads/[id]/list">) {
  try {
    return json(await listSquad((await params).id, await readJson(request)));
  } catch (error) {
    if (error instanceof BadRequest) return json({ error: error.message }, 400);
    return failed("POST /api/squads/:id/list", error);
  }
}
