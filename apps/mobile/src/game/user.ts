import { useSyncExternalStore } from 'react';

import type { AuthProfile, RegisterRequest } from '@champion/shared';

import { changeAccountPassword, createUser, fetchProfile, fetchWallet, loginAccount, registerAccount } from '@/api/client';

import { loadJSON, saveJSON } from './storage';

/**
 * Your online identity: a secret id and a generated username, created on first launch and kept
 * on the device. Registering adds email, password and name to it; logging in on another device
 * brings the same account there.
 */

export type User = { userId: string; username: string; name?: string | null; email?: string | null };

let user: User | null = loadJSON<User>('user');
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

/** The saved user, or a new one from the server (once; retried on the next call if offline). */
export function ensureUser(): Promise<User> {
  if (user) return Promise.resolve(user);
  pending ??= createUser()
    .then((u) => {
      user = { userId: u.userId, username: u.username };
      saveJSON('user', user);
      listeners.forEach((l) => l());
      return user;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/**
 * Account backup: the userId is the key to the online account (username, leaderboard squads,
 * coins). Entering it on another device restores that account there; checked with the server.
 */
export async function restoreUser(code: string): Promise<boolean> {
  const userId = code.trim();
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return false;
  try {
    const wallet = await fetchWallet(userId);
    user = { userId, username: wallet.username };
    saveJSON('user', user);
    listeners.forEach((l) => l());
    return true;
  } catch {
    return false;
  }
}

const setUser = (next: User | null) => {
  user = next;
  saveJSON('user', user);
  listeners.forEach((l) => l());
};

const asUser = (p: AuthProfile): User => ({ userId: p.userId, username: p.username, name: p.name, email: p.email });

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

/** Logs out: the next online action starts a fresh guest account on this device. */
export function logout() {
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
