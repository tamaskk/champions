import "server-only";

import { ADS_PER_DAY } from "@champion/shared";
import { randomBytes, verify } from "node:crypto";

import { adTickets } from "./db";
import { BadRequest, userOf } from "./leaderboard-data";
import { adViewsToday, creditAdView } from "./wallet-data";

/**
 * Real rewarded ads (AdMob), paid only on AdMob's signed server-side verification (SSV):
 *  1. The app asks POST /api/ads/ticket: a one-time random ticket for the signed-in user (so no
 *     userId ever goes to Google or into a URL).
 *  2. The app loads the ad with the ticket as SSV `custom_data`, and shows it.
 *  3. When the view earns the reward, Google calls GET /api/ads/ssv?…&custom_data=<ticket>
 *     &transaction_id=…&signature=…&key_id=…; we check the signature with Google's published keys,
 *     map the ticket to the user and credit the coins once per transaction id (wallet ledger).
 */

const KEYS_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json";
const KEYS_TTL_MS = 24 * 3600_000;

export async function issueAdTicket(body: { userId?: string } | null): Promise<{ ticket: string } | { ticket: null; reason: string }> {
  const user = await userOf(body?.userId);
  if ((await adViewsToday(user.userId)) >= ADS_PER_DAY) return { ticket: null, reason: "That's all the videos for today" };
  const ticket = randomBytes(18).toString("base64url");
  await (await adTickets()).insertOne({ _id: ticket, userId: user.userId, createdAt: new Date(), usedAt: null });
  return { ticket };
}

let keyCache: { at: number; keys: Map<string, string> } | null = null;

async function verifierKey(keyId: string): Promise<string | null> {
  const fresh = keyCache && Date.now() - keyCache.at < KEYS_TTL_MS;
  // Unknown key id: Google may have rotated – fetch again (at most once per call).
  if (!fresh || !keyCache!.keys.has(keyId)) {
    const res = await fetch(KEYS_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`AdMob verifier keys: HTTP ${res.status}`);
    const data = (await res.json()) as { keys: { keyId: number | string; pem: string }[] };
    keyCache = { at: Date.now(), keys: new Map(data.keys.map((k) => [String(k.keyId), k.pem])) };
  }
  return keyCache!.keys.get(keyId) ?? null;
}

/**
 * Checks an SSV callback's signature. Google signs the query string up to (not including)
 * "&signature=", exactly as sent; signature and key_id are the last two parameters.
 */
export async function verifySsvSignature(rawQuery: string): Promise<boolean> {
  const cut = rawQuery.indexOf("&signature=");
  if (cut <= 0) return false;
  const message = rawQuery.slice(0, cut);
  const params = new URLSearchParams(rawQuery);
  const signature = params.get("signature");
  const keyId = params.get("key_id");
  if (!signature || !keyId) return false;
  const pem = await verifierKey(keyId);
  if (!pem) return false;
  try {
    return verify("sha256", Buffer.from(message), pem, Buffer.from(signature, "base64url"));
  } catch {
    return false;
  }
}

export type SsvOutcome = "paid" | "duplicate" | "capped" | "unknown-ticket" | "test";

/** Handles one verified callback. Every outcome answers 200 (Google retries on errors). */
export async function handleSsv(rawQuery: string): Promise<SsvOutcome> {
  // A probe without a signature (e.g. checking the URL is reachable): OK, nothing is paid.
  if (!new URLSearchParams(rawQuery).has("signature")) return "test";
  if (!(await verifySsvSignature(rawQuery))) throw new BadRequest("Bad signature");
  const params = new URLSearchParams(rawQuery);
  const ticket = params.get("custom_data");
  const transactionId = params.get("transaction_id");
  // AdMob's "verify URL" test call carries no custom data.
  if (!ticket || !transactionId) return "test";
  const col = await adTickets();
  const doc = await col.findOne({ _id: ticket });
  if (!doc) return "unknown-ticket";
  const outcome = await creditAdView(doc.userId, transactionId.slice(0, 100));
  await col.updateOne({ _id: ticket, usedAt: null }, { $set: { usedAt: new Date() } });
  return outcome;
}
