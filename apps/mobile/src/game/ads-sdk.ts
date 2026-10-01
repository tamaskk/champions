/**
 * The AdMob SDK, where it exists. This is the web version: there is none (Metro would otherwise
 * bundle the native-only package and fail). Phones load `ads-sdk.native.ts`.
 */
export type Sdk = typeof import('react-native-google-mobile-ads');

export function loadSdk(): Sdk | null {
  return null;
}
