import { postHandler, preflight } from "@/server/cors";
import { registerPush } from "@/server/push-data";

export const OPTIONS = preflight;

/** POST /api/push/register – the device's Expo push token for "your XI was beaten" (or off). */
export const POST = postHandler("POST /api/push/register", registerPush);
