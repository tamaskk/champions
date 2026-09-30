import type { CrashReport } from "@champion/shared";

import { recordCrash } from "@/server/analytics-data";
import { postHandler, preflight } from "@/server/cors";

export const OPTIONS = preflight;

/** POST /api/crashes – a JavaScript error from the app. */
export const POST = postHandler<CrashReport, { ok: true }>("POST /api/crashes", (body) => recordCrash(body));
