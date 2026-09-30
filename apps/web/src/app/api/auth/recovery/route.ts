import { postHandler, preflight } from "@/server/cors";
import { newRecoveryCode } from "@/server/auth-data";

export const OPTIONS = preflight;

/** POST /api/auth/recovery – a new backup code for the signed-in account (shown once). */
export const POST = postHandler("POST /api/auth/recovery", newRecoveryCode);
