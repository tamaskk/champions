import { H2H_RANKS, H2H_RANK_REWARDS, type ClaimSource, type WalletResponse } from '@champion/shared';
import { useSyncExternalStore } from 'react';

import {
  buyStoreItem,
  claimCoins,
  fetchWallet,
  redeemInviteCode,
  renameUser,
  simulatePurchase,
  consumeStoreItem,
} from '@/api/client';

import { onRewards, pushToast } from './progress';
import { ensureUser, refreshProfile } from './user';

/**
 * The coin wallet as the device sees it. Coins live on the server (the device can't mint them):
 * this store only mirrors the balance, asks for claims when something happened in the game and
 * shows a "+N coins" notice for whatever the server granted.
 */

export type WalletState = { status: 'idle' | 'loading' | 'ready' | 'offline'; wallet: WalletResponse | null };

let state: WalletState = { status: 'idle', wallet: null };
const listeners = new Set<() => void>();
const set = (next: WalletState) => {
  state = next;
  listeners.forEach((l) => l());
};

export function useWallet(): WalletState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export const requestId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Reloads the wallet from the server (keeps the last one when offline). */
export async function refreshWallet(): Promise<WalletResponse | null> {
  if (state.status === 'idle') set({ ...state, status: 'loading' });
  try {
    const user = await ensureUser();
    const wallet = await fetchWallet(user.userId);
    set({ status: 'ready', wallet });
    return wallet;
  } catch {
    set({ ...state, status: 'offline' });
    return null;
  }
}

const setBalance = (balance: number) => state.wallet && set({ ...state, wallet: { ...state.wallet, balance } });

/** Asks the server for coins; shows a notice when some were granted. Silent otherwise. */
export async function claim(source: ClaimSource, key: string, label: string): Promise<number> {
  try {
    const user = await ensureUser();
    const r = await claimCoins(user.userId, source, key);
    if (r.granted > 0) {
      setBalance(r.balance);
      pushToast({ icon: 'toll', title: `+${r.granted} coins`, detail: label, tone: 'coin' });
      // A head-to-head win may have reached a new monthly rank.
      if (source === 'h2h-win') {
        const wallet = await refreshWallet();
        if (wallet) await claimH2HRanks(wallet);
      }
    }
    return r.granted;
  } catch {
    return 0;
  }
}

/** On app start: load the wallet, collect the daily login (and the Spinvincible Club's daily coins). */
export async function initWallet() {
  const wallet = await refreshWallet();
  if (!wallet) return;
  if (!wallet.login.claimedToday) await claim('daily-login', 'today', `Daily login · day ${((wallet.login.streakDay % 7) || 0) + 1}`);
  if (wallet.entitlements.clubUntil && new Date(wallet.entitlements.clubUntil) > new Date()) {
    await claim('club-daily', 'today', 'Spinvincible Club daily coins');
  }
  await claimH2HRanks(wallet);
  await refreshWallet();
}

/** Monthly head-to-head rank rewards reached so far (the server checks the wins; once a month). */
async function claimH2HRanks(wallet: WalletResponse) {
  for (const rank of H2H_RANKS) {
    if (H2H_RANK_REWARDS[rank.id] && wallet.h2h.wins >= rank.wins) {
      await claim('h2h-rank', rank.id, `Head-to-head ${rank.name} this month`);
    }
  }
}

// Level-ups and achievements (recorded on the device) are paid by the server.
onRewards(({ levels, achievements }) => {
  for (const level of levels) void claim('level-up', String(level), `Level ${level} reached`);
  for (const id of achievements) void claim('achievement', id, 'Achievement unlocked');
});

export type SpendResult = { ok: boolean; reason?: string };

/** Buys a store item with coins. */
export async function buy(itemId: string): Promise<SpendResult> {
  try {
    const user = await ensureUser();
    const r = await buyStoreItem(user.userId, itemId, requestId());
    setBalance(r.balance);
    await refreshWallet();
    return { ok: r.ok, reason: r.reason };
  } catch {
    return { ok: false, reason: 'Offline' };
  }
}

/** Uses one convenience item (extra re-spin, second chance, …). */
export async function consumeItem(itemId: string): Promise<boolean> {
  try {
    const user = await ensureUser();
    const r = await consumeStoreItem(user.userId, itemId, requestId());
    await refreshWallet();
    return r.ok;
  } catch {
    return false;
  }
}

export const itemCount = (itemId: string) => state.wallet?.consumables[itemId] ?? 0;

export async function redeemInvite(code: string): Promise<SpendResult> {
  try {
    const user = await ensureUser();
    const r = await redeemInviteCode(user.userId, code);
    if (r.granted > 0) pushToast({ icon: 'card_giftcard', title: `+${r.granted} coins`, detail: 'Invite redeemed', tone: 'coin' });
    await refreshWallet();
    return { ok: r.granted > 0, reason: r.reason };
  } catch {
    return { ok: false, reason: 'Offline' };
  }
}

export async function changeUsername(username: string): Promise<SpendResult> {
  try {
    const user = await ensureUser();
    const r = await renameUser(user.userId, username, requestId());
    await refreshWallet();
    if (r.ok) await refreshProfile();
    return { ok: r.ok, reason: r.reason };
  } catch {
    return { ok: false, reason: 'Offline' };
  }
}

/** Development: the server credits a product as if the app store confirmed the payment. */
export async function devPurchase(productId: string): Promise<SpendResult> {
  try {
    const user = await ensureUser();
    const wallet = await simulatePurchase(user.userId, productId, requestId());
    set({ status: 'ready', wallet });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Purchases are not available' };
  }
}
