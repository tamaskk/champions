import "server-only";

import {
  PASSWORD_MIN,
  normalizeEmail,
  validateRegistration,
  type AuthProfile,
  type LoginRequest,
  type RegisterRequest,
} from "@champion/shared";
import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { coinLedger, dailyScores, h2hTickets, miniLeagues, savedSquads, users, wallets, type UserDoc } from "./db";
import { BadRequest, userOf } from "./leaderboard-data";
import { emailConfigured, sendEmail } from "./mailer";

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

export type DeleteAccountResult = { ok: true } | { ok: false; error: string };

/**
 * Deletes an account and everything tied to it (App Store rule 5.1.1(v)): saved squads, daily
 * scores, the wallet and its coin ledger, head-to-head tickets, mini-league memberships (the owner
 * role passes on, a league left empty is deleted) and invite links. A registered account must
 * confirm with its password; a guest's userId (the device's secret) is enough. The user record goes
 * last, so a deletion that fails half-way can simply be retried.
 */
export async function deleteAccount(body: { userId?: unknown; password?: string } | null): Promise<DeleteAccountResult> {
  const user = await userOf(body?.userId);
  if (user.passwordHash && !(await checkPassword(body?.password ?? "", user.passwordHash))) {
    return { ok: false, error: "Password is wrong" };
  }
  const userId = user.userId;

  const leagues = await miniLeagues();
  for (const league of await leagues.find({ members: userId }).toArray()) {
    const rest = league.members.filter((m) => m !== userId);
    if (rest.length === 0) await leagues.deleteOne({ _id: league._id });
    else
      await leagues.updateOne(
        { _id: league._id },
        { $pull: { members: userId }, $set: { ownerId: league.ownerId === userId ? rest[0]! : league.ownerId } },
      );
  }
  await Promise.all([
    (await savedSquads()).deleteMany({ userId }),
    (await dailyScores()).deleteMany({ userId }),
    (await h2hTickets()).deleteMany({ userId }),
    (await coinLedger()).deleteMany({ userId }),
    (await wallets()).deleteMany({ userId }),
    // Friends this player invited keep their coins (and stay "invited"), without the link to this account.
    (await wallets()).updateMany({ invitedBy: userId }, { $set: { invitedBy: "deleted-account" } }),
  ]);
  await (await users()).deleteOne({ userId });
  return { ok: true };
}

// ---- Forgotten password: a 6-digit code by email, or the account's backup code.

const RESET_MINUTES = 15;
const RESET_MAX_TRIES = 5;
/** At most one email per address this often. */
const RESET_RESEND_SECONDS = 60;

const resetHash = (userId: string, code: string) => createHash("sha256").update(`${userId}:${code}`).digest("hex");

/**
 * Emails a 6-digit reset code to a registered address. The answer is the same whether or not the
 * address has an account (don't reveal which accounts exist), except when email isn't set up.
 */
export async function requestPasswordReset(body: { email?: string } | null): Promise<{ ok: boolean; error?: string }> {
  const email = normalizeEmail(body?.email ?? "");
  if (!email) return { ok: false, error: "Enter your email" };
  if (!emailConfigured() && process.env.NODE_ENV === "production") {
    return { ok: false, error: "Email codes aren't available yet – use your backup code instead" };
  }
  const col = await users();
  const user = await col.findOne({ email });
  if (!user?.passwordHash) return { ok: true };
  if (user.resetSentAt && Date.now() - user.resetSentAt.getTime() < RESET_RESEND_SECONDS * 1000) return { ok: true };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await col.updateOne(
    { userId: user.userId },
    {
      $set: {
        resetCodeHash: resetHash(user.userId, code),
        resetExpires: new Date(Date.now() + RESET_MINUTES * 60_000),
        resetAttempts: 0,
        resetSentAt: new Date(),
      },
    },
  );
  await sendEmail(
    email,
    `Your Spinvincible code: ${code}`,
    `Your code to set a new Spinvincible password is ${code}.\n\nIt works for ${RESET_MINUTES} minutes. If you didn't ask for it, ignore this email – your password stays the same.`,
  );
  return { ok: true };
}

async function setNewPassword(userId: string, newPassword: string) {
  await (await users()).updateOne(
    { userId },
    {
      $set: {
        passwordHash: await hashPassword(newPassword),
        failedLogins: 0,
        lockedUntil: null,
        resetCodeHash: null,
        resetExpires: null,
        resetAttempts: 0,
      },
    },
  );
}

/**
 * Sets a new password with the emailed code, or with the account's backup code (the userId the app
 * lets you save under Profile). Returns the profile, so the app is logged in straight away.
 */
export async function resetPassword(
  body: { email?: string; code?: string; backupCode?: string; newPassword?: string } | null,
): Promise<AuthProfile | { error: string }> {
  const email = normalizeEmail(body?.email ?? "");
  const newPassword = body?.newPassword ?? "";
  if (newPassword.length < PASSWORD_MIN) return { error: `New password: at least ${PASSWORD_MIN} characters` };
  const col = await users();
  const user = email ? await col.findOne({ email }) : null;
  const invalid = { error: "That code is wrong or has expired" };
  if (!user?.passwordHash) return invalid;

  const backup = (body?.backupCode ?? "").trim();
  if (backup) {
    const a = Buffer.from(backup);
    const b = Buffer.from(user.userId);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { error: "That backup code doesn't belong to this email" };
  } else {
    const code = (body?.code ?? "").replace(/\D/g, "");
    if (!user.resetCodeHash || !user.resetExpires || user.resetExpires < new Date()) return invalid;
    if ((user.resetAttempts ?? 0) >= RESET_MAX_TRIES) return { error: "Too many tries – ask for a new code" };
    const ok = code.length === 6 && timingSafeEqual(Buffer.from(resetHash(user.userId, code)), Buffer.from(user.resetCodeHash));
    if (!ok) {
      await col.updateOne({ userId: user.userId }, { $inc: { resetAttempts: 1 } });
      return invalid;
    }
  }
  await setNewPassword(user.userId, newPassword);
  return profileOf(user);
}
