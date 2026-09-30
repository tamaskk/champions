import { handleSsv } from "@/server/ads-data";
import { rateLimitResponse } from "@/server/cors";

/**
 * GET /api/ads/ssv – AdMob's rewarded-ad server-side verification callback. No session: the
 * request is authenticated by Google's signature. 200 for every handled case; 400 for a bad
 * signature; 500 lets Google retry later.
 */
export async function GET(request: Request) {
  const limited = await rateLimitResponse("GET /api/ads/ssv", request);
  if (limited) return limited;
  const rawQuery = new URL(request.url).search.slice(1);
  try {
    const outcome = await handleSsv(rawQuery);
    return Response.json({ ok: true, outcome });
  } catch (error) {
    if (error instanceof Error && error.name === "BadRequest") {
      console.warn("AdMob SSV rejected:", error.message);
      return Response.json({ ok: false }, { status: 400 });
    }
    console.error("AdMob SSV failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
