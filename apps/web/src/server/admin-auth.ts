// Admin login. The username and password come from the environment (.env):
//   ADMIN_USER, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET (signs the session cookie).
// Without ADMIN_PASSWORD nobody can log in – not even in development.
//
// A successful login sets an HMAC-signed, httpOnly session cookie (expiry + signature). proxy.ts
// checks it for every /admin page; Server Actions check it again because they can be POSTed
// directly. Uses Web Crypto so the same code runs in the proxy and in Node.

export const ADMIN_COOKIE = "champion_admin";
export const SESSION_HOURS = 12;

const encoder = new TextEncoder();

function safeEqual(a: string, b: string): boolean {
  // Compare full length whatever the input, so timing doesn't leak where they differ.
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export const adminConfigured = () => !!process.env.ADMIN_PASSWORD;

export function checkAdminCredentials(user: string, password: string): boolean {
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedPassword) return false;
  const userOk = safeEqual(user, process.env.ADMIN_USER || "admin");
  const passOk = safeEqual(password, expectedPassword);
  return userOk && passOk;
}

/** Changing the password (or the secret) signs everyone out. */
async function key() {
  const secret = `${process.env.ADMIN_SESSION_SECRET ?? ""}|${process.env.ADMIN_PASSWORD ?? ""}`;
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function sign(payload: string): Promise<string> {
  const mac = await crypto.subtle.sign("HMAC", await key(), encoder.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(mac))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Cookie value "<expiry ms>.<signature>". */
export async function createAdminSession(): Promise<{ value: string; expires: Date }> {
  const expires = new Date(Date.now() + SESSION_HOURS * 3_600_000);
  const payload = String(expires.getTime());
  return { value: `${payload}.${await sign(payload)}`, expires };
}

export async function verifyAdminSession(value: string | undefined | null): Promise<boolean> {
  if (!value || !adminConfigured()) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !/^\d+$/.test(payload)) return false;
  if (Number(payload) < Date.now()) return false;
  return safeEqual(signature, await sign(payload));
}
