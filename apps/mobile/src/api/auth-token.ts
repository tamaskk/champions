/**
 * This device's session token, sent as "Authorization: Bearer …" with every API request. Set by the
 * user store (game/user.ts); kept here so the API client doesn't depend on the store.
 */
let token: string | null = null;

export function setAuthToken(next: string | null | undefined) {
  token = next ?? null;
}

export function authHeaders(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
