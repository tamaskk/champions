import "server-only";

import {
  PASSWORD_MIN,
  normalizeEmail,
  validateRegistration,
  type AuthProfile,
  type LoginRequest,
  type RegisterRequest,
} from "@champion/shared";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { users, type UserDoc } from "./db";
import { BadRequest, userOf } from "./leaderboard-data";

/**
 * Email + password accounts on top of the guest users (see packages/shared/src/auth.ts).
 * Passwords are stored as salted scrypt hashes; too many failed logins lock the account briefly.
 * A login returns the account's userId, which the app keeps as its credential (as for guests).
 */

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_LENGTH = 64;
const MAX_FAILED_LOGINS = 10;
const LOCK_MINUTES = 15;
/** Same message for unknown email and wrong password: don't reveal which accounts exist. */
const WRONG = "Wrong email or password";

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [kind, saltHex, hashHex] = stored.split("$");
  if (kind !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const profileOf = (u: UserDoc): AuthProfile => ({
  userId: u.userId,
  username: u.username,
  name: u.name ?? null,
  email: u.email ?? null,
});

/** Case-insensitive: "Zizou" and "zizou" can't both exist. */
async function usernameTaken(username: string, exceptUserId: string) {
  const found = await (await users()).findOne(
    { username, userId: { $ne: exceptUserId } },
    { collation: { locale: "en", strength: 2 } },
  );
  return !!found;
}

/** Turns the current guest account into a registered one (keeps coins, squads, username history). */
export async function register(body: Partial<RegisterRequest> | null): Promise<AuthProfile | { errors: Record<string, string> }> {
  const user = await userOf(body?.userId);
  if (user.email) throw new BadRequest("This account is already registered – log in instead");
  const errors = validateRegistration(body ?? {});
  if (Object.keys(errors).length) return { errors: errors as Record<string, string> };

  const email = normalizeEmail(body!.email!);
  const username = body!.username!.trim();
  const col = await users();
  if (await col.findOne({ email })) return { errors: { email: "An account with this email already exists" } };
  if (await usernameTaken(username, user.userId)) return { errors: { username: "This username is taken" } };

  try {
    await col.updateOne(
      { userId: user.userId, email: { $exists: false } },
      {
        $set: {
          email,
          name: body!.name!.trim(),
          username,
          passwordHash: await hashPassword(body!.password!),
          registeredAt: new Date(),
          failedLogins: 0,
          lockedUntil: null,
        },
      },
    );
  } catch {
    // Unique index race: someone took the email or username meanwhile.
    return { errors: { email: "Email or username already in use" } };
  }
  return profileOf((await col.findOne({ userId: user.userId }))!);
}

export async function login(body: Partial<LoginRequest> | null): Promise<AuthProfile | { error: string }> {
  const email = normalizeEmail(body?.email ?? "");
  const password = body?.password ?? "";
  if (!email || !password) return { error: WRONG };
  const col = await users();
  const user = await col.findOne({ email });
  if (!user?.passwordHash) return { error: WRONG };
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { error: `Too many attempts – try again in ${LOCK_MINUTES} minutes` };
  }
  if (!(await checkPassword(password, user.passwordHash))) {
    const failed = (user.failedLogins ?? 0) + 1;
    await col.updateOne(
      { userId: user.userId },
      {
        $set: {
          failedLogins: failed >= MAX_FAILED_LOGINS ? 0 : failed,
          lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      },
    );
    return { error: WRONG };
  }
  await col.updateOne({ userId: user.userId }, { $set: { failedLogins: 0, lockedUntil: null } });
  return profileOf(user);
}

export async function me(body: { userId?: unknown } | null): Promise<AuthProfile> {
  return profileOf(await userOf(body?.userId));
}

export async function changePassword(
  body: { userId?: unknown; oldPassword?: string; newPassword?: string } | null,
): Promise<{ ok: boolean; error?: string }> {
  const user = await userOf(body?.userId);
  if (!user.passwordHash) return { ok: false, error: "Register first" };
  if (!(await checkPassword(body?.oldPassword ?? "", user.passwordHash))) return { ok: false, error: "Current password is wrong" };
  if ((body?.newPassword ?? "").length < PASSWORD_MIN) return { ok: false, error: `At least ${PASSWORD_MIN} characters` };
  await (await users()).updateOne({ userId: user.userId }, { $set: { passwordHash: await hashPassword(body!.newPassword!) } });
  return { ok: true };
}
