import { useSyncExternalStore } from 'react';

import type { AuthProfile, RegisterRequest } from '@champion/shared';

import {
  changeAccountPassword,
  createUser,
  deleteAccountRequest,
  requestPasswordReset,
  resetPasswordRequest,
  fetchProfile,
  legacySessionRequest,
  loginAccount,
  logoutRequest,
  newRecoveryCode,
  registerAccount,
  restoreRequest,
} from '@/api/client';
import { setAuthToken } from '@/api/auth-token';

import { eraseDeviceData, loadJSON, saveJSON } from './storage';

/**
 * Your online identity: an account id, a generated username and this device's session token (sent
 * with every request – the id alone signs nobody in). Created on first launch; registering adds
 * email, password and name; logging in or restoring with the backup code brings the account to
 * another device.
 */

export type User = { userId: string; username: string; name?: string | null; email?: string | null; token?: string };

let user: User | null = loadJSON<User>('user');
setAuthToken(user?.token);
let pending: Promise<User> | null = null;
const listeners = new Set<() => void>();

export function useUser(): User | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => user,
  );
}

const setUser = (next: User | null) => {
  user = next;
  setAuthToken(next?.token);
  saveJSON('user', user);
  listeners.forEach((l) => l());
};

/**
 * The signed-in user: the saved one, a saved one from before sessions moved onto a token (once), or
 * a new guest from the server. Retried on the next call if offline.
 */
export function ensureUser(): Promise<User> {
  if (user?.token) return Promise.resolve(user);
  pending ??= (async () => {
    if (user && !user.token) {
      try {
        const r = await legacySessionRequest(user.userId);
        setUser({ ...user, token: r.token });
        return user!;
      } catch {
        // Refused (the account already has sessions): this install must log in again.
        setUser(null);
      }
    }
    const u = await createUser();
    setUser({ userId: u.userId, username: u.username, token: u.token });
    return user!;
  })().finally(() => {
    pending = null;
  });
  return pending;
}

/** Restores an account on this device with its backup code (from Profile → Account backup). */
export async function restoreUser(code: string): Promise<AuthResult> {
  try {
    const r = await restoreRequest(code);
    if ('error' in r) return { ok: false, error: r.error };
    setUser(asUser(r));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No connection to the server' };
  }
}

/** A new backup code for this account (the previous one stops working). Shown once. */
export async function createBackupCode(): Promise<string | null> {
  try {
    await ensureUser();
    return (await newRecoveryCode()).code;
  } catch {
    return null;
  }
}

/** A profile from the server; keeps this device's token unless the answer brings a new one. */
const asUser = (p: AuthProfile): User => ({
  userId: p.userId,
  username: p.username,
  name: p.name,
  email: p.email,
  token: p.token ?? (user?.userId === p.userId ? user.token : undefined),
});

export type AuthResult = { ok: true } | { ok: false; error?: string; errors?: Record<string, string> };

/** Registers the current (guest) account: keeps its username history, coins and saved squads. */
export async function register(form: Omit<RegisterRequest, 'userId'>): Promise<AuthResult> {
  try {
    const current = await ensureUser();
    const r = await registerAccount({ ...form, userId: current.userId });
    if ('errors' in r) return { ok: false, errors: r.errors };
    if ('error' in r) return { ok: false, error: r.error };
    setUser(asUser(r));
    return { ok: true };
  } catch {
    return { ok: false, error: 'No connection to the server' };
  }
}

/** Logs in to a registered account; this device then uses that account. */
export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    const r = await loginAccount({ email, password });
    if ('error' in r) return { ok: false, error: r.error };
    setUser(asUser(r));
    return { ok: true };
  } catch {
    return { ok: false, error: 'No connection to the server' };
  }
}

/** Logs out (the server ends this device's session); the next online action starts a fresh guest. */
export function logout() {
  void logoutRequest().catch(() => undefined);
  setUser(null);
}

/** Refreshes name/email/username from the server (e.g. after a rename). */
export async function refreshProfile() {
  if (!user) return;
  try {
    setUser(asUser(await fetchProfile(user.userId)));
  } catch {
    // Offline: keep what we have.
  }
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<AuthResult> {
  if (!user) return { ok: false, error: 'Not logged in' };
  try {
    const r = await changeAccountPassword(user.userId, oldPassword, newPassword);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  } catch {
    return { ok: false, error: 'No connection to the server' };
  }
}

/**
 * Deletes the account on the server (coins, saved squads, scores, mini-leagues – everything) and
 * erases the game's data on this device. Registered accounts confirm with their password.
 */
export async function deleteAccount(password?: string): Promise<AuthResult> {
  if (!user) return { ok: false, error: 'No account on this device' };
  try {
    const r = await deleteAccountRequest(user.userId, password);
    if (!r.ok) return { ok: false, error: r.error ?? 'Could not delete the account' };
  } catch {
    return { ok: false, error: 'No connection to the server' };
  }
  eraseDeviceData();
  setUser(null);
  return { ok: true };
}

/** Forgotten password, step 1: a 6-digit code to the account's email. */
export async function sendResetCode(email: string): Promise<AuthResult> {
  try {
    const r = await requestPasswordReset(email);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  } catch {
    return { ok: false, error: 'No connection to the server' };
  }
}

/** Forgotten password, step 2: the emailed code (or the backup code) and a new password – then logged in. */
export async function resetPassword(email: string, proof: { code?: string; backupCode?: string }, newPassword: string): Promise<AuthResult> {
  try {
    const r = await resetPasswordRequest({ email, ...proof, newPassword });
    if ('error' in r) return { ok: false, error: r.error };
    setUser(asUser(r));
    return { ok: true };
  } catch {
    return { ok: false, error: 'No connection to the server' };
  }
}
