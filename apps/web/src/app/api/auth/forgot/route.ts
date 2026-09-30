import { postHandler, preflight } from "@/server/cors";
import { requestPasswordReset } from "@/server/auth-data";

export const OPTIONS = preflight;

/** POST /api/auth/forgot {email} – emails a 6-digit code to set a new password. */
export const POST = postHandler("POST /api/auth/forgot", requestPasswordReset);
