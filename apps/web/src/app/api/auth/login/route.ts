import { postHandler, preflight } from "@/server/cors";
import { login } from "@/server/auth-data";

export const OPTIONS = preflight;

/** POST /api/auth/login {email, password} – the account's profile (with its userId) or an error. */
export const POST = postHandler("POST /api/auth/login", login);
