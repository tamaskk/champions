import { postHandler, preflight } from "@/server/cors";
import { issueAdTicket } from "@/server/ads-data";

export const OPTIONS = preflight;

/** POST /api/ads/ticket – a one-time ticket for the next rewarded ad (sent to AdMob as SSV custom data). */
export const POST = postHandler("POST /api/ads/ticket", issueAdTicket);
