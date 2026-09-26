import { postHandler, preflight } from "@/server/cors";
import { changePassword } from "@/server/auth-data";

export const OPTIONS = preflight;

/** POST /api/auth/password {userId, oldPassword, newPassword} – change the password. */
export const POST = postHandler("POST /api/auth/password", changePassword);
