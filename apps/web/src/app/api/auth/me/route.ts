import { postHandler, preflight } from "@/server/cors";
import { me } from "@/server/auth-data";

export const OPTIONS = preflight;

/** POST /api/auth/me {userId} – username, name and email of the account. */
export const POST = postHandler("POST /api/auth/me", me);
