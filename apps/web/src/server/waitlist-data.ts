import "server-only";

import { waitlist } from "./db";

// Launch waitlist: emails from the landing page. One entry per address (lower-cased); signing up
// twice is fine and just says you're already on the list.

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;

export type JoinResult = { ok: true; already: boolean; position: number } | { ok: false; error: string };

export async function joinWaitlist(input: { email: string; source: string; locale: string | null }): Promise<JoinResult> {
  const email = input.email.trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return { ok: false, error: "That doesn't look like an email address." };
  const col = await waitlist();
  const res = await col.updateOne(
    { email },
    {
      $setOnInsert: {
        email,
        createdAt: new Date(),
        source: input.source.slice(0, 20) || "landing",
        locale: input.locale?.slice(0, 20) ?? null,
      },
    },
    { upsert: true },
  );
  const doc = await col.findOne({ email }, { projection: { createdAt: 1 } });
  const position = doc ? await col.countDocuments({ createdAt: { $lte: doc.createdAt } }) : await col.countDocuments();
  return { ok: true, already: res.upsertedCount === 0, position };
}

export async function waitlistStats(limit = 200) {
  const col = await waitlist();
  const [total, today, latest] = await Promise.all([
    col.countDocuments(),
    col.countDocuments({ createdAt: { $gte: new Date(new Date().toISOString().slice(0, 10)) } }),
    col.find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(limit).toArray(),
  ]);
  return { total, today, latest };
}

/** Every address, oldest first (admin CSV export). */
export async function allWaitlist() {
  return (await waitlist()).find({}, { projection: { _id: 0 } }).sort({ createdAt: 1 }).toArray();
}
