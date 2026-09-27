"use client";

import { useActionState, useState } from "react";

import { grantCoinsAction, type GrantState } from "@/app/admin/actions";
import { buttonClass } from "@/components/admin/ui";

const input = "rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink";

/** Credit coins to one player. A fresh request id per submit, so a double click counts once. */
export function GrantForm({ userId, username }: { userId: string; username: string }) {
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(async (prev: GrantState, data: FormData) => {
    const next = await grantCoinsAction(prev, data);
    if (next.status === "done") setRequestId(crypto.randomUUID());
    return next;
  }, { status: "idle" } as GrantState);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="requestId" value={requestId} />
      <input
        name="amount"
        type="number"
        step={1}
        required
        placeholder="coins"
        aria-label={`Coins for ${username}`}
        className={`${input} w-24 tabular-nums`}
      />
      <input name="note" maxLength={200} placeholder="note (optional)" aria-label="Note" className={`${input} w-44`} />
      <button disabled={pending} className={buttonClass.primary}>
        {pending ? "…" : "Credit"}
      </button>
      {state.status === "done" && (
        <span className="text-xs font-medium text-emerald-600">
          {state.amount > 0 ? "+" : ""}
          {state.amount} → balance {state.balance}
        </span>
      )}
      {state.status === "error" && <span className="text-xs font-medium text-rose-500">{state.message}</span>}
    </form>
  );
}
