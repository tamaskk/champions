// HTTP Basic Auth for /admin. Shared by proxy.ts (page requests) and Server Actions,
// which are reachable by direct POST and must check on their own.

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** No ADMIN_PASSWORD: open in development, locked in production. */
export function isAdminAuthorized(authorization: string | null): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return process.env.NODE_ENV !== "production";
  if (!authorization?.startsWith("Basic ")) return false;

  let decoded: string;
  try {
    decoded = atob(authorization.slice("Basic ".length));
  } catch {
    return false;
  }
  const separator = decoded.indexOf(":");
  if (separator < 0) return false;
  const user = decoded.slice(0, separator);
  const pass = decoded.slice(separator + 1);
  return safeEqual(user, process.env.ADMIN_USER || "admin") && safeEqual(pass, password);
}
