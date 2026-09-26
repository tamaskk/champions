"use client";

import { useActionState } from "react";

import { adminLogin, type LoginState } from "./actions";

const field =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(adminLogin, { error: null });
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        Username
        <input name="user" autoComplete="username" required className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        Password
        <input name="password" type="password" autoComplete="current-password" required className={field} />
      </label>
      {state.error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{state.error}</p>}
      <button
        disabled={pending}
        className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-ink/90 disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
