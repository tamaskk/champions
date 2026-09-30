import { failed, json, preflight, readJson } from "@/server/cors";
import { legacySession } from "@/server/auth-data";

export const OPTIONS = preflight;

/**
 * POST /api/auth/session {userId} – one-time move of an install from before sessions onto a token
 * (reads the raw body on purpose: the install has no token yet). Refused once the account has one.
 */
export async function POST(request: Request) {
  try {
    const r = await legacySession(await readJson<{ userId?: string }>(request));
    return "error" in r ? json(r, 403) : json(r);
  } catch (error) {
    return failed("POST /api/auth/session", error);
  }
}
