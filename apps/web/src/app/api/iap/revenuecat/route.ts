import { CLUB_SUBSCRIPTION, COIN_PACKS, SEASON_PASS_PRODUCT, STARTER_PACK } from "@champion/shared";

import { json } from "@/server/cors";
import { users } from "@/server/db";
import { applyPurchase, type Purchase } from "@/server/wallet-data";

/**
 * POST /api/iap/revenuecat – RevenueCat webhook. RevenueCat sends the Authorization header set in
 * its dashboard; it must equal REVENUECAT_WEBHOOK_AUTH. The app logs in to RevenueCat with our
 * userId, so `app_user_id` is the wallet owner. Every event is applied once (its id).
 */
type RevenueCatEvent = {
  id: string;
  type: string;
  app_user_id: string;
  product_id: string;
  expiration_at_ms?: number | null;
};

const PAID = new Set(["INITIAL_PURCHASE", "NON_RENEWING_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION"]);

export async function POST(request: Request) {
  const secret = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (!secret || request.headers.get("authorization") !== secret) return json({ error: "Unauthorized" }, 401);

  let event: RevenueCatEvent;
  try {
    event = ((await request.json()) as { event: RevenueCatEvent }).event;
  } catch {
    return json({ error: "Bad body" }, 400);
  }
  if (!event?.id || !event.app_user_id) return json({ error: "Bad event" }, 400);
  if (!(await (await users()).findOne({ userId: event.app_user_id }))) return json({ ok: true, ignored: "unknown user" });

  let purchase: Purchase | null = null;
  const pack = COIN_PACKS.find((p) => p.id === event.product_id);
  if (event.product_id === CLUB_SUBSCRIPTION.id && (PAID.has(event.type) || event.type === "EXPIRATION")) {
    purchase = { kind: "club", until: new Date(event.expiration_at_ms ?? Date.now()) };
  } else if (PAID.has(event.type)) {
    if (pack) purchase = { kind: "coins", productId: pack.id, coins: pack.coins };
    else if (event.product_id === STARTER_PACK.id) purchase = { kind: "starter" };
    else if (event.product_id === SEASON_PASS_PRODUCT.id) purchase = { kind: "season-pass" };
  }
  if (!purchase) return json({ ok: true, ignored: event.type });

  try {
    await applyPurchase(event.app_user_id, event.id, purchase);
    return json({ ok: true });
  } catch (error) {
    console.error("RevenueCat webhook failed", error);
    // 500 makes RevenueCat retry later; the event id keeps the retry from paying twice.
    return json({ error: "Retry" }, 500);
  }
}
