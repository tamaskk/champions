import { bearerToken, sessionUserId } from "./session";

// Public game API: CORS open so the Expo web build (another port) can call it, including the
// JSON POSTs of the online features (they need a preflight).
// Auth is a bearer token in the Authorization header (never a cookie), so an open origin can't
// act for anyone: a page on another site doesn't have the player's token.
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const preflight = () => new Response(null, { status: 204, headers: CORS });

export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: CORS });

export function failed(route: string, error: unknown) {
  console.error(`${route} failed`, error);
  return json({ error: "Database unavailable" }, 503);
}

/** Request body as JSON, or null. */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export type Auth = { userId: string | null; token: string | null };

/**
 * The request body with `userId` set from the session token – whatever the client put there is
 * replaced, so a body can never choose whose account it acts on. No valid token: no userId.
 */
export async function readAuthedJson<T>(request: Request): Promise<{ body: T | null; auth: Auth }> {
  const body = await readJson<Record<string, unknown>>(request);
  const userId = await sessionUserId(request);
  const auth = { userId, token: bearerToken(request) };
  if (body && typeof body === "object") {
    if (userId) body.userId = userId;
    else delete body.userId;
  }
  return { body: (body ?? (userId ? { userId } : null)) as T | null, auth };
}

/** POST handler: JSON body in (userId from the session), JSON out; BadRequest → 400. */
export function postHandler<B, R>(route: string, work: (body: B | null, auth: Auth) => Promise<R>) {
  return async (request: Request) => {
    try {
      const { body, auth } = await readAuthedJson<B>(request);
      return json(await work(body, auth));
    } catch (error) {
      if (error instanceof Error && error.name === "BadRequest") {
        return json({ error: error.message }, (error as { status?: number }).status ?? 400);
      }
      return failed(route, error);
    }
  };
}
