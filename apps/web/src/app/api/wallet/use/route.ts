import { postHandler, preflight } from "@/server/cors";
import { consumeItem } from "@/server/wallet-data";

export const OPTIONS = preflight;

/** POST /api/wallet/use {userId, itemId, requestId} – use one convenience item (casual modes only). */
export const POST = postHandler("POST /api/wallet/use", consumeItem);
