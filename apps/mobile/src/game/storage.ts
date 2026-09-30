import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Small JSON storage on the device: a file in the app's documents folder (localStorage on web).
 * Every call is wrapped – a failing store never breaks the game, it just doesn't remember.
 */

export function loadJSON<T>(name: string): T | null {
  try {
    if (Platform.OS === 'web') {
      const raw = globalThis.localStorage?.getItem(`champion:${name}`);
      return raw ? (JSON.parse(raw) as T) : null;
    }
    const file = new File(Paths.document, `${name}.json`);
    return file.exists ? (JSON.parse(file.textSync()) as T) : null;
  } catch {
    return null;
  }
}

export function saveJSON(name: string, data: unknown): void {
  try {
    const text = JSON.stringify(data);
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(`champion:${name}`, text);
      return;
    }
    const file = new File(Paths.document, `${name}.json`);
    if (!file.exists) file.create();
    file.write(text);
  } catch {
    // Not remembered this time.
  }
}

/** Everything the game keeps on this device (used when the account is deleted). */
const DEVICE_FILES = [
  'user',
  'progress',
  'records',
  'daily',
  'daily-draft',
  'daily-match',
  'league-season',
  'legends',
  'notifications',
];

/** Erases the game's data on this device; the app starts fresh on its next launch. */
export function eraseDeviceData(): void {
  for (const name of DEVICE_FILES) saveJSON(name, null);
}
