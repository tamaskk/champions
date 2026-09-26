import "server-only";

import { dailyForDate, type DailyChallenge, type DailyResponse } from "@champion/shared";

import { dailyChallenges } from "./db";

/** The day's challenge: scheduled in the admin, or the built-in pool in turn. */
export async function dailyChallenge(date: string): Promise<DailyResponse> {
  const scheduled = await (
    await dailyChallenges()
  ).findOne({ date }, { projection: { _id: 0, createdAt: 0, source: 0 } });
  return dailyForDate(date, scheduled ? [scheduled] : []);
}

/** Scheduled challenges from a date on (admin list). */
export async function scheduledDailies(fromDate: string) {
  return (await dailyChallenges())
    .find({ date: { $gte: fromDate } }, { projection: { _id: 0 } })
    .sort({ date: 1 })
    .limit(200)
    .toArray();
}

/** Upserts challenges by date (a day has one challenge). Returns how many were saved. */
export async function saveDailies(list: DailyChallenge[], source: "admin" | "import" | "claude") {
  const col = await dailyChallenges();
  let saved = 0;
  for (const ch of list) {
    if (!ch.date) continue;
    await col.updateOne(
      { date: ch.date },
      { $set: { ...ch, date: ch.date, source }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
    saved++;
  }
  return saved;
}

/** Back to the built-in pool for that day. */
export async function deleteDaily(date: string) {
  await (await dailyChallenges()).deleteOne({ date });
}
