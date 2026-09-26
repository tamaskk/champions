/**
 * Email + password accounts. A player starts as a guest (generated username, secret userId on the
 * device); registering adds email, password and name to that same account, so nothing is lost.
 * Logging in on another device brings the account (username, coins, saved squads) there.
 */

export type AuthProfile = {
  userId: string;
  username: string;
  name: string | null;
  email: string | null;
};

export type RegisterRequest = { userId: string; email: string; password: string; name: string; username: string };
export type LoginRequest = { email: string; password: string };

export const PASSWORD_MIN = 8;
export const NAME_MAX = 40;
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Problems with a registration form, per field (empty = fine). Used by the app and the server. */
export function validateRegistration(r: Partial<RegisterRequest>): Partial<Record<keyof RegisterRequest, string>> {
  const errors: Partial<Record<keyof RegisterRequest, string>> = {};
  const name = (r.name ?? '').trim();
  if (!name) errors.name = 'Enter your name';
  else if (name.length > NAME_MAX) errors.name = `At most ${NAME_MAX} characters`;
  if (!USERNAME_PATTERN.test(r.username ?? '')) errors.username = '3–20 letters, digits or _';
  if (!EMAIL_PATTERN.test(normalizeEmail(r.email ?? ''))) errors.email = 'Enter a valid email address';
  if ((r.password ?? '').length < PASSWORD_MIN) errors.password = `At least ${PASSWORD_MIN} characters`;
  return errors;
}
