import { postHandler, preflight } from "@/server/cors";
import { deleteAccount } from "@/server/auth-data";

export const OPTIONS = preflight;

/** POST /api/auth/delete {userId, password?} – deletes the account and all its data. */
export const POST = postHandler("POST /api/auth/delete", deleteAccount);
