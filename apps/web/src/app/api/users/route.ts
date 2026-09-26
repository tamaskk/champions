import { failed, json, preflight } from "@/server/cors";
import { createUser } from "@/server/leaderboard-data";

export const OPTIONS = preflight;

/** POST /api/users – a new player with a generated username (the userId stays on the device). */
export async function POST() {
  try {
    return json(await createUser());
  } catch (error) {
    return failed("POST /api/users", error);
  }
}
