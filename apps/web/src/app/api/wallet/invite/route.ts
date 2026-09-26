import { postHandler, preflight } from "@/server/cors";
import { redeemInvite } from "@/server/wallet-data";

export const OPTIONS = preflight;

/** POST /api/wallet/invite {userId, code} – a new player redeems a friend's code: coins for both. */
export const POST = postHandler("POST /api/wallet/invite", redeemInvite);
