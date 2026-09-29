"use client";

import { useActionState, useState } from "react";

import { joinWaitlistAction, type WaitlistState } from "@/app/waitlist-actions";

/** Email sign-up for the launch. `source` tells the two forms on the page apart. */
export function WaitlistForm({ source, align = "left" }: { source: string; align?: "left" | "center" }) {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(joinWaitlistAction, { status: "idle" });
  const [renderedAt] = useState(() => Date.now());

  if (state.status === "done") {
    return (
      <div
        role="status"
        className={`flex items-center gap-3 rounded-2xl border border-[#6ddc9e]/30 bg-[#6ddc9e]/10 px-5 py-4 ${
          align === "center" ? "mx-auto max-w-md" : "max-w-md"
        }`}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#6ddc9e] text-[#003920]" aria-hidden>
          ✓
        </span>
        <div className="text-left">
          <p className="font-semibold text-[#dce3f1]">
            {state.already ? "You're already on the list." : "You're on the list!"}
          </p>
          <p className="text-sm text-[#bdcabe]">
            {state.position > 0 ? `Number ${state.position.toLocaleString("en-US")} in line. ` : ""}
            We&apos;ll email you once, on launch day.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className={`w-full max-w-md ${align === "center" ? "mx-auto" : ""}`} noValidate>
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="t" value={renderedAt} suppressHydrationWarning />
      {/* Honeypot: hidden from people, filled by bots. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur sm:flex-row">
        <label htmlFor={`email-${source}`} className="sr-only">
          Email address
        </label>
        <input
          id={`email-${source}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          aria-invalid={state.status === "error"}
          aria-describedby={`note-${source}`}
          className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 text-base text-[#dce3f1] placeholder:text-[#879489] focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[#ffc72c] px-5 py-3 font-[family-name:var(--font-display)] text-base font-bold text-[#3f2e00] transition hover:bg-[#ffd555] focus-visible:ring-2 focus-visible:ring-[#ffc72c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d141e] focus-visible:outline-none disabled:opacity-60"
        >
          {pending ? "Joining…" : "Get early access"}
        </button>
      </div>
      <p
        id={`note-${source}`}
        className={`mt-3 text-sm ${state.status === "error" ? "text-[#ffb4ab]" : "text-[#879489]"} ${
          align === "center" ? "text-center" : ""
        }`}
      >
        {state.status === "error"
          ? state.message
          : "One email on launch day. No spam – your address is only used for this."}
      </p>
    </form>
  );
}
