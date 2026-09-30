import "server-only";

import { todayKey } from "@champion/shared";
import { after } from "next/server";

import { users } from "./db";
import { BadRequest, userOf } from "./leaderboard-data";

// Remote push through Expo's push service: "your XI was beaten", at most one a day per player.
// The token is stored only while the player has the switch on; the daily reminder is local.

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const isExpoToken = (x: unknown): x is string =>
  typeof x === "string" && x.length < 200 && /^Expo(nent)?PushToken\[[^\]]+\]$/.test(x);

export async function registerPush(body: { userId?: string; token?: unknown; beaten?: unknown } | null) {
  const user = await userOf(body?.userId);
  const on = body?.beaten === true;
  if (on && !isExpoToken(body?.token)) throw new BadRequest("token");
  await (await users()).updateOne({ userId: user.userId }, { $set: { pushToken: on ? (body!.token as string) : null } });
  return { ok: true as const };
}

async function send(ownerId: string, title: string, message: string) {
  const col = await users();
  const today = todayKey();
  // Claims today's one push atomically (two wins at once send one).
  const owner = await col.findOneAndUpdate(
    { userId: ownerId, pushToken: { $type: "string" }, beatenPushDay: { $ne: today } },
    { $set: { beatenPushDay: today } },
    { projection: { pushToken: 1 } },
  );
  if (!owner?.pushToken) return;
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ to: owner.pushToken, title, body: message, sound: "default" }),
  });
  const data = (await res.json().catch(() => null)) as { data?: { status?: string; details?: { error?: string } } } | null;
  // Uninstalled app / revoked permission: forget the token.
  if (data?.data?.details?.error === "DeviceNotRegistered")
    await col.updateOne({ userId: ownerId }, { $set: { pushToken: null } });
}

/**
 * After the response: tells the owner of a saved squad that `byUsername` beat it. Never for your
 * own squad; failures are only logged (a push is never worth failing a match for).
 */
export function notifyBeaten(ownerId: string | undefined, winnerId: string, byUsername: string, score: string) {
  if (!ownerId || ownerId === winnerId) return;
  after(() =>
    send(ownerId, "Your XI was beaten", `@${byUsername} beat your saved squad ${score}. Draft a new XI and hit back.`).catch(
      (error) => console.error("push failed", error),
    ),
  );
}
