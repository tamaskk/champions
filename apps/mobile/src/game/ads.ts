import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { adTicket } from '@/api/client';

import { claim, isClubMember, refreshWallet } from './wallet';

/**
 * Rewarded ads (Google AdMob, react-native-google-mobile-ads).
 *
 * Coins for a real ad are paid by the server only: the app gets a one-time ticket from
 * POST /api/ads/ticket, passes it to AdMob as server-side verification custom data, and AdMob's
 * signed callback (/api/ads/ssv) credits the wallet. The app just refreshes the balance.
 *
 * Google's test ad units are used unless EXPO_PUBLIC_ADS_LIVE=1 (store builds only – never watch
 * your own live ads). Test ads send no callback to our server, so there the app claims the
 * reward itself, which the server pays only in development or with ADS_SIMULATED=1.
 *
 * No native module (Expo Go, web): `available` is false and the shop falls back to its simulated ad.
 * Consent: Google's UMP form (EEA/UK/CH) runs before the SDK starts; ads load only if allowed.
 */

const LIVE = process.env.EXPO_PUBLIC_ADS_LIVE === '1';
const UNITS = {
  ios: 'ca-app-pub-8452423089974780/8781769841',
  android: 'ca-app-pub-8452423089974780/8590198157',
} as const;
/** Interstitial after a finished tournament. Empty until the AdMob units exist (live builds then show none). */
const INTERSTITIAL_UNITS: { ios: string; android: string } = {
  ios: '',
  android: '',
};
/** At least this long between two interstitials. */
const INTERSTITIAL_GAP_MS = 30_000;
/** Shown a moment after the result, so the player sees it first. */
const INTERSTITIAL_DELAY_MS = 1200;

type Sdk = typeof import('react-native-google-mobile-ads');

function loadSdk(): Sdk | null {
  if (Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-google-mobile-ads') as Sdk;
  } catch {
    return null;
  }
}

const sdk = loadSdk();

export type AdsState = {
  /** The ad SDK is in this build. */
  available: boolean;
  /** Consent gathered and the SDK started: ads may be requested. */
  ready: boolean;
  /** The player must be able to reopen the consent choices (EEA/UK). */
  privacyOptions: boolean;
  live: boolean;
};

let state: AdsState = { available: !!sdk, ready: false, privacyOptions: false, live: LIVE };
const listeners = new Set<() => void>();
const set = (patch: Partial<AdsState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export function useAds(): AdsState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

let starting: Promise<void> | null = null;

/** Once per app start: consent form if required, then the SDK. */
export function startAds(): Promise<void> {
  if (!sdk) return Promise.resolve();
  starting ??= (async () => {
    try {
      const info = await sdk.AdsConsent.gatherConsent();
      const privacyOptions = info.privacyOptionsRequirementStatus === sdk.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
      if (!info.canRequestAds) return set({ privacyOptions });
      await sdk.default().setRequestConfiguration({ maxAdContentRating: sdk.MaxAdContentRating.T });
      await sdk.default().initialize();
      set({ ready: true, privacyOptions });
      preloadInterstitial();
    } catch {
      // Offline or the consent service failed: tried again on the next start.
      starting = null;
    }
  })();
  return starting;
}

/** Reopens the consent choices (Profile → Ad privacy). */
export async function showAdPrivacyOptions() {
  if (!sdk) return;
  try {
    await sdk.AdsConsent.showPrivacyOptionsForm();
    const info = await sdk.AdsConsent.getConsentInfo();
    set({ ready: state.ready && info.canRequestAds });
    if (info.canRequestAds && !state.ready) {
      starting = null;
      await startAds();
    }
  } catch {
    // Form not available right now.
  }
}

export type AdResult = 'earned' | 'closed' | 'unavailable' | 'limit';

const requestId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Loads and shows one rewarded ad; resolves when it is closed. */
export async function watchRewardedAd(): Promise<AdResult> {
  if (!sdk) return 'unavailable';
  await startAds();
  if (!state.ready) return 'unavailable';
  let ticket: string | null = null;
  if (LIVE) {
    const t = await adTicket().catch(() => null);
    if (!t) return 'unavailable';
    if (!t.ticket) return 'limit';
    ticket = t.ticket;
  }
  const unit = LIVE ? UNITS[Platform.OS === 'ios' ? 'ios' : 'android'] : sdk.TestIds.REWARDED;
  const ad = sdk.RewardedAd.createForAdRequest(
    unit,
    ticket ? { serverSideVerificationOptions: { customData: ticket } } : undefined,
  );

  const outcome = await new Promise<AdResult>((resolve) => {
    let earned = false;
    const subs = [
      ad.addAdEventListener(sdk.RewardedAdEventType.LOADED, () => {
        ad.show().catch(() => finish('unavailable'));
      }),
      ad.addAdEventListener(sdk.RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      ad.addAdEventListener(sdk.AdEventType.CLOSED, () => finish(earned ? 'earned' : 'closed')),
      ad.addAdEventListener(sdk.AdEventType.ERROR, () => finish('unavailable')),
    ];
    function finish(r: AdResult) {
      subs.forEach((unsubscribe) => unsubscribe());
      resolve(r);
    }
    ad.load();
  });

  if (outcome === 'earned') {
    if (LIVE) void collectPaid();
    else void claim('rewarded-ad', requestId(), 'Thanks for watching');
  }
  return outcome;
}

/** Live ads: the server credits on AdMob's callback, usually within seconds – refresh a few times. */
async function collectPaid() {
  const before = (await refreshWallet())?.adsToday ?? 0;
  for (const wait of [1500, 3000, 5000, 10000]) {
    await new Promise((r) => setTimeout(r, wait));
    const w = await refreshWallet();
    if (w && w.adsToday > before) return;
  }
}

// ---- Interstitial after a finished tournament (match, league season, cup, legends, challenge,
// head-to-head). Never in the Daily, never for Club members (their perk is no ads).

type Interstitial = ReturnType<Sdk['InterstitialAd']['createForAdRequest']>;
let interstitial: { ad: Interstitial; loaded: boolean } | null = null;
let lastInterstitial = 0;

function interstitialUnit(): string | null {
  if (!sdk) return null;
  if (!LIVE) return sdk.TestIds.INTERSTITIAL;
  return INTERSTITIAL_UNITS[Platform.OS === 'ios' ? 'ios' : 'android'] || null;
}

function preloadInterstitial() {
  const unit = interstitialUnit();
  if (!sdk || !unit || !state.ready || interstitial) return;
  const ad = sdk.InterstitialAd.createForAdRequest(unit);
  const slot = { ad, loaded: false };
  interstitial = slot;
  ad.addAdEventListener(sdk.AdEventType.LOADED, () => {
    slot.loaded = true;
  });
  ad.addAdEventListener(sdk.AdEventType.ERROR, () => {
    // No fill / offline: try again on the next finished tournament.
    if (interstitial === slot) interstitial = null;
  });
  ad.addAdEventListener(sdk.AdEventType.CLOSED, () => {
    if (interstitial === slot) interstitial = null;
    preloadInterstitial();
  });
  ad.load();
}

/** Call when a tournament has been played to the end. Shows the preloaded ad if there is one. */
export function showInterstitialAfterGame() {
  if (!sdk || !state.ready || isClubMember()) return;
  if (Date.now() - lastInterstitial < INTERSTITIAL_GAP_MS) return;
  const slot = interstitial;
  if (!slot?.loaded) {
    preloadInterstitial();
    return;
  }
  lastInterstitial = Date.now();
  setTimeout(() => {
    slot.ad.show().catch(() => {
      if (interstitial === slot) interstitial = null;
      preloadInterstitial();
    });
  }, INTERSTITIAL_DELAY_MS);
}
