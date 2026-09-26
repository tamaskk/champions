import { postHandler, preflight } from "@/server/cors";
import { claim } from "@/server/wallet-data";

export const OPTIONS = preflight;

/** POST /api/wallet/claim {userId, source, key} – collect coins; the server decides the amount. */
export const POST = postHandler("POST /api/wallet/claim", claim);
