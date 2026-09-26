// Public game API: CORS open so the Expo web build (another port) can call it, including the
// JSON POSTs of the online features (they need a preflight).
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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

/** POST handler: JSON body in, JSON out; BadRequest (thrown by the data layer) → 400. */
export function postHandler<B, R>(route: string, work: (body: B | null) => Promise<R>) {
  return async (request: Request) => {
    try {
      return json(await work(await readJson<B>(request)));
    } catch (error) {
      if (error instanceof Error && error.name === "BadRequest") return json({ error: error.message }, 400);
      return failed(route, error);
    }
  };
}
