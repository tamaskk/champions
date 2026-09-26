import { postHandler, preflight } from "@/server/cors";
import { rename } from "@/server/wallet-data";

export const OPTIONS = preflight;

/** POST /api/wallet/rename {userId, username, requestId} – change the username for coins. */
export const POST = postHandler("POST /api/wallet/rename", rename);
