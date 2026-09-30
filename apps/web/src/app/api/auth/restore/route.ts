import { postHandler, preflight } from "@/server/cors";
import { restoreWithCode } from "@/server/auth-data";

export const OPTIONS = preflight;

/** POST /api/auth/restore {code} – restores an account on this device with its backup code. */
export const POST = postHandler("POST /api/auth/restore", restoreWithCode);
