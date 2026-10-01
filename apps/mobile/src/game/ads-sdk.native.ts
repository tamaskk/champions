import Constants, { ExecutionEnvironment } from 'expo-constants';

export type Sdk = typeof import('react-native-google-mobile-ads');

/** The AdMob SDK in a build that contains it; null in Expo Go (no native module there). */
export function loadSdk(): Sdk | null {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-google-mobile-ads') as Sdk;
  } catch {
    return null;
  }
}
