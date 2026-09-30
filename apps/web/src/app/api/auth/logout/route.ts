import { postHandler, preflight } from "@/server/cors";
import { logout } from "@/server/auth-data";

export const OPTIONS = preflight;

/** POST /api/auth/logout – signs this device out (its token stops working). */
export const POST = postHandler("POST /api/auth/logout", logout);
