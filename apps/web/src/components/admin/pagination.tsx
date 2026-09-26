import Link from "next/link";

/** Page numbers to show: first, last, current ±1, with gaps as null. */
function pageItems(page: number, pages: number): (number | null)[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? [null, p] : [p]));
}

const item = "grid h-9 min-w-9 place-items-center rounded-lg px-3 text-sm tabular-nums";

/** Server-rendered pager: plain links, `query` keeps the current filters and sort. */
export function Pagination({ page, pages, basePath, query }: {
  page: number;
  pages: number;
  basePath: string;
  query: Record<string, string | undefined>;
}) {
  if (pages <= 1) return null;

  const href = (p: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={href(page - 1)} className={`${item} text-ink hover:bg-panel`}>
          ← Prev
        </Link>
      ) : (
        <span className={`${item} text-muted/50`}>← Prev</span>
      )}

      {pageItems(page, pages).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className={`${item} text-muted`}>
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={`${item} ${p === page ? "bg-ink font-medium text-white" : "text-ink hover:bg-panel"}`}
          >
            {p}
          </Link>
        ),
      )}

      {page < pages ? (
        <Link href={href(page + 1)} className={`${item} text-ink hover:bg-panel`}>
          Next →
        </Link>
      ) : (
        <span className={`${item} text-muted/50`}>Next →</span>
      )}
    </nav>
  );
}
