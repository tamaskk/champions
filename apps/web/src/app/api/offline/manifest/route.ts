import { rateLimitResponse } from "@/server/cors";
import { offlineManifest } from "@/server/offline-data";

const HEADERS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, s-maxage=3600" };

/** GET /api/offline/manifest – the files of a complete offline pack and its version. */
export async function GET(request: Request) {
  const limited = await rateLimitResponse("GET /api/offline", request, null);
  if (limited) return limited;
  try {
    return Response.json(await offlineManifest(), { headers: HEADERS });
  } catch (error) {
    console.error("GET /api/offline/manifest failed", error);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
