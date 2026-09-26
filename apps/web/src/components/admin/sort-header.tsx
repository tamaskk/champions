import Link from "next/link";

/**
 * Sortable table header cell for server-rendered lists. Clicking toggles the direction of the
 * active column, or sorts a new column in `firstDir`. `query` keeps the current filters; the page
 * resets to 1 because a new order makes the old page number meaningless.
 */
export function SortHeader({
  column,
  label,
  basePath,
  query,
  sort,
  dir,
  firstDir = "asc",
  align = "left",
  className = "",
}: {
  column: string;
  label: string;
  basePath: string;
  query: Record<string, string | undefined>;
  sort: string | undefined;
  dir: "asc" | "desc";
  firstDir?: "asc" | "desc";
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort === column;
  const next = active ? (dir === "asc" ? "desc" : "asc") : firstDir;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  params.set("sort", column);
  params.set("dir", next);

  return (
    <th
      aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : undefined}
      className={`px-3 py-2.5 font-medium ${align === "right" ? "text-right" : ""} ${className}`}
    >
      <Link
        href={`${basePath}?${params}`}
        className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : ""}`}
      >
        {label}
        <span aria-hidden className={`text-[10px] ${active ? "text-accent" : "text-muted/50"}`}>
          {active ? (dir === "desc" ? "▼" : "▲") : "▲▼"}
        </span>
      </Link>
    </th>
  );
}
