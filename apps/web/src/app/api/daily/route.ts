import { todayKey } from "@champion/shared";
import type { NextRequest } from "next/server";

import { failed, json, preflight, rateLimitResponse } from "@/server/cors";
import { dailyChallenge } from "@/server/daily-data";

export const OPTIONS = preflight;

/** GET /api/daily?date=YYYY-MM-DD – the day's challenge (scheduled in the admin, or from the pool). */
export async function GET(request: NextRequest) {
  const limited = await rateLimitResponse("GET /api/daily", request, null);
  if (limited) return limited;
  const date = request.nextUrl.searchParams.get("date") ?? todayKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "Expected ?date=YYYY-MM-DD" }, 400);
  try {
    return json(await dailyChallenge(date));
  } catch (error) {
    return failed("GET /api/daily", error);
  }
}
