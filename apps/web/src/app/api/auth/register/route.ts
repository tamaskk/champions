import { postHandler, preflight } from "@/server/cors";
import { register } from "@/server/auth-data";

export const OPTIONS = preflight;

/** POST /api/auth/register {userId, email, password, name, username} – register the guest account. */
export const POST = postHandler("POST /api/auth/register", register);
