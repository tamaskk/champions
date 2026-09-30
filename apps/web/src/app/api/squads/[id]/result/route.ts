import { json, preflight } from "@/server/cors";

export const OPTIONS = preflight;

/**
 * POST /api/squads/:id/result – retired: results are no longer sent by the app. Tournaments are
 * played on the server (POST /api/squads/:id/play), which stores the result itself.
 */
export async function POST() {
  return json({ error: "Results are recorded by the server – please update the app" }, 410);
}
