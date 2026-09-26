import { postHandler, preflight } from "@/server/cors";
import { getWallet } from "@/server/wallet-data";

export const OPTIONS = preflight;

/** POST /api/wallet {userId} – balance, owned items, daily login state, invite code, pass. */
export const POST = postHandler<{ userId?: string }, unknown>("POST /api/wallet", (b) => getWallet(b?.userId));
