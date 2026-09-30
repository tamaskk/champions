import { failed, json, preflight, readAuthedJson } from "@/server/cors";
import { BadRequest } from "@/server/leaderboard-data";
import { listSquad } from "@/server/play-data";

export const OPTIONS = preflight;

/** POST /api/squads/:id/list {userId} – puts a squad saved only to play onto the leaderboard. */
export async function POST(request: Request, { params }: RouteContext<"/api/squads/[id]/list">) {
  try {
    const { body } = await readAuthedJson<never>(request);
    return json(await listSquad((await params).id, body));
  } catch (error) {
    if (error instanceof BadRequest) return json({ error: error.message }, error.status);
    return failed("POST /api/squads/:id/list", error);
  }
}
