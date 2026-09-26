import { postHandler, preflight } from "@/server/cors";
import { buyItem } from "@/server/wallet-data";

export const OPTIONS = preflight;

/** POST /api/wallet/buy {userId, itemId, requestId} – buy a store item with coins. */
export const POST = postHandler("POST /api/wallet/buy", buyItem);
