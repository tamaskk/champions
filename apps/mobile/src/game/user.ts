import { useSyncExternalStore } from 'react';

import { createUser, fetchWallet } from '@/api/client';

import { loadJSON, saveJSON } from './storage';

/**
 * Your online identity: a secret id and a generated username, created on first launch and kept
 * on the device.
 */

export type User = { userId: string; username: string };

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
