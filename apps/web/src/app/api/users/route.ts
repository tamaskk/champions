import { failed, json, preflight, rateLimitResponse } from "@/server/cors";
import { createUser } from "@/server/leaderboard-data";

export const OPTIONS = preflight;

/** POST /api/users – a new player with a generated username (the userId stays on the device). */
export async function POST(request: Request) {
  const limited = await rateLimitResponse("POST /api/users", request, null);
  if (limited) return limited;
  try {
    return json(await createUser());
  } catch (error) {
    return failed("POST /api/users", error);
  }
}
