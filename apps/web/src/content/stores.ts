/**
 * Store listings of the app. Leave null until the app is live in that store: pages then point to
 * the waitlist instead of a dead link.
 */
export const STORE_LINKS: { appStore: string | null; playStore: string | null } = {
  /** e.g. "https://apps.apple.com/app/id0000000000" */
  appStore: null,
  /** e.g. "https://play.google.com/store/apps/details?id=com.spinvincible.app" */
  playStore: null,
};
