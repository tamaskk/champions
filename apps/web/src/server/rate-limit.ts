import "server-only";

import { rateLimits } from "./db";
import { BadRequest } from "./leaderboard-data";

/**
 * Rate limits, counted in MongoDB (serverless instances share nothing in memory): a fixed window
 * per key, one atomic upsert per request, counters removed by a TTL index. Routes without an own
 * rule get the generous default; the tight ones are those without a login (IP) and the ones that
 * write or cost the most (per user).
 */

export class RateLimited extends BadRequest {
  status = 429;
}

type Limit = { limit: number; windowSec: number };
type Rule = { ip?: Limit; user?: Limit };

const MIN = 60;
const HOUR = 3600;

/** Per route (the name passed to postHandler / used below). */
export const RATE_RULES: Record<string, Rule> = {
  // No login yet: per IP.
  "POST /api/users": { ip: { limit: 10, windowSec: HOUR } },
  "POST /api/auth/login": { ip: { limit: 30, windowSec: 15 * MIN } },
  "POST /api/auth/register": { ip: { limit: 10, windowSec: HOUR } },
  "POST /api/auth/forgot": { ip: { limit: 5, windowSec: 15 * MIN } },
  "POST /api/auth/reset": { ip: { limit: 20, windowSec: 15 * MIN } },
  "POST /api/auth/restore": { ip: { limit: 10, windowSec: 15 * MIN } },
  "POST /api/auth/session": { ip: { limit: 10, windowSec: 15 * MIN } },
  "waitlist": { ip: { limit: 5, windowSec: HOUR } },
  "admin-login": { ip: { limit: 10, windowSec: 15 * MIN } },
  "GET /api/search": { ip: { limit: 120, windowSec: MIN } },
  // Writes and the expensive ones: per user.
  "POST /api/squads": { user: { limit: 40, windowSec: HOUR } },
  "POST /api/squads/:id/play": { user: { limit: 60, windowSec: HOUR } },
  "POST /api/squads/:id/second-chance": { user: { limit: 30, windowSec: HOUR } },
  "POST /api/h2h/queue": { user: { limit: 60, windowSec: HOUR } },
  "GET /api/h2h/ticket/:id": { user: { limit: 900, windowSec: HOUR } },
  "POST /api/wallet/claim": { user: { limit: 120, windowSec: HOUR } },
  "POST /api/wallet/buy": { user: { limit: 60, windowSec: HOUR } },
  "POST /api/wallet/use": { user: { limit: 120, windowSec: HOUR } },
  "POST /api/wallet/rename": { user: { limit: 10, windowSec: HOUR } },
  "POST /api/wallet/invite": { user: { limit: 10, windowSec: HOUR } },
  "POST /api/leagues/create": { user: { limit: 10, windowSec: HOUR } },
  "POST /api/leagues/join": { user: { limit: 30, windowSec: HOUR } },
  "POST /api/auth/password": { user: { limit: 10, windowSec: HOUR } },
  "POST /api/auth/delete": { user: { limit: 10, windowSec: HOUR } },
  "POST /api/auth/recovery": { user: { limit: 10, windowSec: HOUR } },
};

/** Any other route: plenty for a real player, a wall for a script. */
const DEFAULT_RULE: Rule = { ip: { limit: 1200, windowSec: HOUR }, user: { limit: 1200, windowSec: HOUR } };

/** The caller's IP (Vercel puts the client first in x-forwarded-for). */
export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function hit(key: string, { limit, windowSec }: Limit) {
  const now = Date.now();
  const windowStart = Math.floor(now / (windowSec * 1000)) * windowSec * 1000;
  const doc = await (await rateLimits()).findOneAndUpdate(
    { _id: `${key}|${windowStart}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + windowSec * 1000) } },
    { upsert: true, returnDocument: "after" },
  );
  if ((doc?.count ?? 0) > limit) {
    const wait = Math.max(1, Math.ceil((windowStart + windowSec * 1000 - now) / 60_000));
    throw new RateLimited(`Too many requests – try again in ${wait} minute${wait === 1 ? "" : "s"}`);
  }
}

/** Counts this request against the route's limits; throws RateLimited (429) when over. */
export async function enforceRateLimit(route: string, headers: Headers, userId: string | null) {
  const rule = RATE_RULES[route] ?? DEFAULT_RULE;
  if (rule.ip) await hit(`${route}|ip:${clientIp(headers)}`, rule.ip);
  if (rule.user && userId) await hit(`${route}|user:${userId}`, rule.user);
}
