"use client";

import { useActionState, useState } from "react";

import { joinWaitlistAction, type WaitlistState } from "@/app/waitlist-actions";

/** Email sign-up for the launch: a glass pill with the address and a white button. */
export function WaitlistForm({ source, align = "left" }: { source: string; align?: "left" | "center" }) {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(joinWaitlistAction, { status: "idle" });
  const [renderedAt] = useState(() => Date.now());
  const center = align === "center";

  if (state.status === "done") {
    return (
      <div role="status" className={`flex items-center gap-3 ${center ? "justify-center text-center" : ""}`}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[#0d141e]" aria-hidden>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <path d="M5 12l5 5 9-10" />
          </svg>
        </span>
        <p className="text-left text-sm text-white/80">
          <span className="font-medium text-white">{state.already ? "Already on the list." : "You're on the list."}</span>{" "}
          {state.position > 0 ? `Number ${state.position.toLocaleString("en-US")} in line – ` : ""}one email on launch day.
        </p>
      </div>
    );
  }

  return (
    <form action={action} noValidate className={`w-full max-w-md ${center ? "mx-auto" : ""}`}>
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="t" value={renderedAt} suppressHydrationWarning />
      {/* Honeypot: hidden from people, filled by bots. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label htmlFor={`email-${source}`} className="sr-only">
        Email address
      </label>
      <div className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] p-1.5 backdrop-blur-xl focus-within:border-white/30">
        <input
          id={`email-${source}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="Enter your email"
          aria-invalid={state.status === "error"}
          aria-describedby={`note-${source}`}
          className="min-w-0 flex-1 bg-transparent px-4 py-2 text-[15px] text-white outline-none placeholder:text-white/40"
        />
        <button
          type="submit"
          disabled={pending}
          className="lp-shine shrink-0 cursor-pointer rounded-full bg-white px-5 py-2.5 text-sm font-medium text-[#0d141e] transition-colors duration-200 hover:bg-[#ffc72c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Joining…" : "Join waitlist"}
        </button>
      </div>
      <p
        id={`note-${source}`}
        className={`mt-2.5 px-4 text-xs ${state.status === "error" ? "text-[#ffb4ab]" : "text-white/40"} ${center ? "text-center" : ""}`}
      >
        {state.status === "error" ? state.message : "One email on launch day. No spam."}
      </p>
    </form>
  );
}
