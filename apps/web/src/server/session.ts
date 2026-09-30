import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { sessions } from "./db";

/**
 * Bearer sessions. Every signed-in device holds a random token (sent as "Authorization: Bearer …");
 * the database keeps only its SHA-256 hash, mapped to the account's userId. The userId itself is no
 * longer a credential: request bodies can't choose whose account they act on. Logging out revokes
 * the token; a password change or account deletion revokes the others too.
 */

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await (await sessions()).insertOne({ tokenHash: hash(token), userId, createdAt: now, lastUsedAt: now });
  return token;
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/.exec(header.trim());
  return m ? m[1]! : null;
}

/** The account a request is signed in as (null without a valid token). */
export async function sessionUserId(request: Request): Promise<string | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const col = await sessions();
  const s = await col.findOne({ tokenHash: hash(token) });
  if (!s) return null;
  // Touch at most once an hour (cheap, and enough to spot stale devices).
  if (Date.now() - s.lastUsedAt.getTime() > 3_600_000) {
    await col.updateOne({ _id: s._id }, { $set: { lastUsedAt: new Date() } });
  }
  return s.userId;
}

export async function revokeToken(token: string | null) {
  if (token) await (await sessions()).deleteOne({ tokenHash: hash(token) });
}

/** Signs out every device of an account (except the one making the request, if given). */
export async function revokeSessions(userId: string, keepToken?: string | null) {
  const filter = keepToken ? { userId, tokenHash: { $ne: hash(keepToken) } } : { userId };
  await (await sessions()).deleteMany(filter);
}
