import Link from "next/link";

export const DAY_OPTIONS = [1, 7, 30, 90] as const;

/** ?days= from the query: one of DAY_OPTIONS, default 7. */
export function daysParam(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return (DAY_OPTIONS as readonly number[]).includes(n) ? n : 7;
}

export function DaysFilter({ path, days }: { path: string; days: number }) {
  return (
    <div className="flex gap-1 rounded-xl border border-line bg-white p-1 text-sm">
      {DAY_OPTIONS.map((d) => (
        <Link
          key={d}
          href={`${path}?days=${d}`}
          className={`rounded-lg px-3 py-1.5 ${d === days ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
        >
          {d === 1 ? "24 h" : `${d} days`}
        </Link>
      ))}
    </div>
  );
}
