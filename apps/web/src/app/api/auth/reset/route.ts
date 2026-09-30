import { postHandler, preflight } from "@/server/cors";
import { resetPassword } from "@/server/auth-data";

export const OPTIONS = preflight;

/** POST /api/auth/reset {email, code | backupCode, newPassword} – sets a new password and logs in. */
export const POST = postHandler("POST /api/auth/reset", resetPassword);
