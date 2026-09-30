import { failed, json, preflight, readJson } from "@/server/cors";
import { BadRequest } from "@/server/leaderboard-data";
import { secondChance } from "@/server/play-data";

export const OPTIONS = preflight;

/** POST /api/squads/:id/second-chance {userId, requestId} – uses a Second chance: one more tournament for this squad. */
export async function POST(request: Request, { params }: RouteContext<"/api/squads/[id]/second-chance">) {
  try {
    return json(await secondChance((await params).id, await readJson(request)));
  } catch (error) {
    if (error instanceof BadRequest) return json({ error: error.message }, 400);
    return failed("POST /api/squads/:id/second-chance", error);
  }
}
