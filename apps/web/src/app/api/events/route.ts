import type { EventsRequest } from "@champion/shared";

import { recordEvents } from "@/server/analytics-data";
import { postHandler, preflight } from "@/server/cors";

export const OPTIONS = preflight;

/** POST /api/events – anonymous analytics events from the app (batched). */
export const POST = postHandler<EventsRequest, Awaited<ReturnType<typeof recordEvents>>>("POST /api/events", (body) =>
  recordEvents(body),
);
