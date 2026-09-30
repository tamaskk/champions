/**
 * Universal Links (iOS) and App Links (Android): which app may open this site's links. The app side
 * is in apps/mobile/app.json (`ios.associatedDomains`, `android.intentFilters`); keep the paths and
 * the domain in step with it. Only shared squad pages (/s/:id) open in the app.
 */
export const APP_LINKS = {
  /** Apple Team ID + bundle id. */
  iosAppId: "DFZXH4SYRV.com.spinvincible.app",
  androidPackage: "com.spinvincible.app",
  /** Paths the app handles (AASA syntax; Android uses the same prefix). */
  paths: ["/s/*"],
} as const;

/**
 * SHA-256 fingerprints of the Android signing certificate(s), from `ANDROID_CERT_SHA256`
 * (comma-separated, "AB:CD:…"). EAS shows it: `eas credentials` → Android → Keystore. Play App
 * Signing adds a second one (Play Console → App integrity).
 */
export function androidFingerprints(): string[] {
  return (process.env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
}
