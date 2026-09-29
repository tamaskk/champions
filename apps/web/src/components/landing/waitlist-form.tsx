"use client";

import { useActionState, useState } from "react";

import { joinWaitlistAction, type WaitlistState } from "@/app/waitlist-actions";

/** Email sign-up for the launch. `tone` matches the section it sits on. */
export function WaitlistForm({ source, tone = "paper" }: { source: string; tone?: "paper" | "ink" }) {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(joinWaitlistAction, { status: "idle" });
  const [renderedAt] = useState(() => Date.now());
  const ink = tone === "ink";

  if (state.status === "done") {
    return (
      <div role="status" className={`border-l-4 border-[#1f6b3a] py-1 pl-4 ${ink ? "text-[#f3efe6]" : "text-[#0d141e]"}`}>
        <p className="font-[family-name:var(--font-display)] text-3xl font-extrabold uppercase">
          {state.already ? "Already on the list" : "You're in"}
        </p>
        <p className={`mt-1 ${ink ? "text-[#c9d1dc]" : "text-[#4a5361]"}`}>
          {state.position > 0 ? `Number ${state.position.toLocaleString("en-US")} in the queue. ` : ""}
          One email, on launch day.
        </p>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="w-full">
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="t" value={renderedAt} suppressHydrationWarning />
      {/* Honeypot: hidden from people, filled by bots. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label
        htmlFor={`email-${source}`}
        className={`mb-2 block font-[family-name:var(--font-mono)] text-xs tracking-[0.18em] uppercase ${
          ink ? "text-[#8a94a3]" : "text-[#4a5361]"
        }`}
      >
        Email for launch day
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-0">
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
          className={`min-w-0 flex-1 border-2 px-4 py-3.5 text-lg outline-none transition-colors duration-200 ${
            ink
              ? "border-[#f3efe6] bg-transparent text-[#f3efe6] placeholder:text-[#6b7686] focus:border-[#ffc72c]"
              : "border-[#0d141e] bg-white text-[#0d141e] placeholder:text-[#8a8f98] focus:border-[#1f6b3a]"
          }`}
        />
        <button
          type="submit"
          disabled={pending}
          className={`cursor-pointer border-2 px-6 py-3.5 font-[family-name:var(--font-display)] text-xl font-black tracking-wide uppercase transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-70 ${
            ink
              ? "border-[#ffc72c] bg-[#ffc72c] text-[#0d141e] hover:bg-[#ffd75e] focus-visible:outline-[#ffc72c]"
              : "border-[#0d141e] bg-[#0d141e] text-[#f3efe6] hover:bg-[#1f6b3a] hover:border-[#1f6b3a] focus-visible:outline-[#0d141e]"
          }`}
        >
          {pending ? "Joining…" : "Join the waitlist"}
        </button>
      </div>
      <p
        id={`note-${source}`}
        className={`mt-2.5 text-sm ${
          state.status === "error" ? (ink ? "text-[#ffb4ab]" : "text-[#b42318]") : ink ? "text-[#8a94a3]" : "text-[#4a5361]"
        }`}
      >
        {state.status === "error" ? state.message : "No spam. We only use your address to tell you when it's out."}
      </p>
    </form>
  );
}
