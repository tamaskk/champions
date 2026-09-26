import { CLUB_SUBSCRIPTION, COIN_PACKS, SEASON_PASS_PRODUCT, STARTER_PACK } from "@champion/shared";

import { json, postHandler, preflight } from "@/server/cors";
import { userOf } from "@/server/leaderboard-data";
import { applyPurchase, getWallet, purchasesSimulated, type Purchase } from "@/server/wallet-data";

export const OPTIONS = preflight;

/**
 * POST /api/wallet/simulate-purchase {userId, productId, requestId} – development only: credits a
 * product as if the store had confirmed it, so the purchase flow can be tested without RevenueCat.
 */
const handler = postHandler<{ userId?: string; productId?: string; requestId?: string }, unknown>(
  "POST /api/wallet/simulate-purchase",
  async (b) => {
    const user = await userOf(b?.userId);
    const productId = b?.productId ?? "";
    const pack = COIN_PACKS.find((p) => p.id === productId);
    const purchase: Purchase | null = pack
      ? { kind: "coins", productId, coins: pack.coins }
      : productId === STARTER_PACK.id
        ? { kind: "starter" }
        : productId === SEASON_PASS_PRODUCT.id
          ? { kind: "season-pass" }
          : productId === CLUB_SUBSCRIPTION.id
            ? { kind: "club", until: new Date(Date.now() + 30 * 86_400_000) }
            : null;
    if (!purchase) return { error: "Unknown product" };
    await applyPurchase(user.userId, `sim-${String(b?.requestId ?? "").slice(0, 64)}`, purchase);
    return getWallet(user.userId);
  },
);

export async function POST(request: Request) {
  if (!purchasesSimulated()) return json({ error: "Not available" }, 404);
  return handler(request);
}
