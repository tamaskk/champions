import type { SquadResult } from "@champion/shared";

import { failed, json, preflight, readJson } from "@/server/cors";
import { BadRequest, addSquadResult } from "@/server/leaderboard-data";

export const OPTIONS = preflight;

/** POST /api/squads/:id/result { userId, result } – what the saved squad achieved. */
export async function POST(request: Request, { params }: RouteContext<"/api/squads/[id]/result">) {
  try {
    await addSquadResult((await params).id, await readJson<{ userId?: string; result?: SquadResult }>(request));
    return json({ ok: true });
  } catch (error) {
    if (error instanceof BadRequest) return json({ error: error.message }, 400);
    return failed("POST /api/squads/:id/result", error);
  }
}
