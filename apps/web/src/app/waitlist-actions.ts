"use server";

import { headers } from "next/headers";

import { joinWaitlist } from "@/server/waitlist-data";

export type WaitlistState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; already: boolean; position: number };

/** Minimum time between rendering the form and submitting it (bots fill forms instantly). */
const MIN_FILL_MS = 1500;

/** Landing page sign-up for the launch. */
export async function joinWaitlistAction(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  const email = formData.get("email");
  const source = formData.get("source");
  const renderedAt = Number(formData.get("t"));
  // Honeypot: a field people never see; bots fill it. Pretend it worked.
  if (formData.get("company")) return { status: "done", already: false, position: 0 };
  if (typeof email !== "string" || !email.trim()) return { status: "error", message: "Enter your email address." };
  if (!Number.isFinite(renderedAt) || Date.now() - renderedAt < MIN_FILL_MS) {
    return { status: "error", message: "Please try again in a moment." };
  }
  try {
    const locale = (await headers()).get("accept-language")?.split(",")[0] ?? null;
    const r = await joinWaitlist({ email, source: typeof source === "string" ? source : "landing", locale });
    return r.ok ? { status: "done", already: r.already, position: r.position } : { status: "error", message: r.error };
  } catch {
    return { status: "error", message: "We couldn't save that right now – please try again." };
  }
}
