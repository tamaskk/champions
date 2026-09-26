import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { RAW_DIR, requireEnv } from "../env";

/**
 * Transfermarkt blocks plain HTTP clients, so pages are fetched through Apify's `apify/web-fetch`
 * Actor (renders the page and gets past the bot protection). About $0.0015 per page.
 * Every successful page is cached under data/raw/transfermarkt/, so re-runs cost nothing.
 */
const ACTOR_URL = "https://api.apify.com/v2/acts/apify~web-fetch/run-sync-get-dataset-items";
const MAX_ATTEMPTS = 3;

export const TM_RAW_DIR = path.join(RAW_DIR, "transfermarkt");

export type FetchResult = { html: string; fromCache: boolean };

type WebFetchItem = { html?: string | null; fetch?: { httpStatusCode?: number } };

export class FetchError extends Error {
  constructor(
    message: string,
    /** false for answers that won't change on retry (e.g. Transfermarkt 404), to not pay again. */
    readonly retryable = true,
    /** Apify said "too many runs at once / too many requests": wait and retry, not a real failure. */
    readonly busy = false,
  ) {
    super(message);
  }
}

async function fetchOnce(url: string, token: string): Promise<string> {
  const response = await fetch(`${ACTOR_URL}?timeout=120`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url, formats: ["html"] }),
    signal: AbortSignal.timeout(150_000),
  });
  if (!response.ok) {
    const body = await response.text();
    // Free plan: max 5 Actor runs at once → 402 concurrent-runs-limit-exceeded. Also 429 rate limits.
    const busy = response.status === 429 || /concurrent-runs-limit|rate-limit/i.test(body);
    throw new FetchError(`Apify ${response.status}: ${body.slice(0, 300)}`, true, busy);
  }
  const items = (await response.json()) as WebFetchItem[];
  const item = items[0];
  const status = item?.fetch?.httpStatusCode;
  if (!item?.html) throw new FetchError(`No HTML returned (HTTP ${status ?? "?"})`);
  if (status && status !== 200) {
    throw new FetchError(`Transfermarkt answered HTTP ${status}`, !(status >= 400 && status < 500 && status !== 429));
  }
  return item.html;
}

/**
 * Returns the page from the cache, or fetches and caches it. `isValid` guards the cache: a page
 * that fails it (captcha, error page) is not written, so the next run tries again.
 */
export async function fetchCached(
  url: string,
  cacheFile: string,
  options: { refetch?: boolean; isValid?: (html: string) => boolean } = {},
): Promise<FetchResult> {
  const file = path.join(TM_RAW_DIR, cacheFile);
  if (!options.refetch && existsSync(file)) {
    const html = await readFile(file, "utf8");
    // A cached page that fails the check (e.g. truncated) is fetched again.
    if (!options.isValid || options.isValid(html)) return { html, fromCache: true };
  }

  const token = requireEnv("APIFY_TOKEN");
  let lastError: unknown;
  let busyWaits = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const html = await fetchOnce(url, token);
      if (options.isValid && !options.isValid(html)) {
        throw new FetchError("Page does not look like the expected Transfermarkt page");
      }
      // Write-then-rename, so an interrupted run never leaves a half-written page in the cache.
      await mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, html);
      await rename(tmp, file);
      return { html, fromCache: false };
    } catch (error) {
      lastError = error;
      if (error instanceof FetchError && !error.retryable) break;
      // Apify busy: wait (5s, 10s, … max 60s) without using up an attempt, for up to ~15 minutes.
      if (error instanceof FetchError && error.busy && busyWaits < 20) {
        busyWaits++;
        attempt--;
        await new Promise((r) => setTimeout(r, Math.min(60_000, 5_000 * busyWaits) + Math.random() * 2_000));
        continue;
      }
      if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 2_000 * attempt));
    }
  }
  throw new FetchError(`${url}: ${(lastError as Error).message}`);
}

/** Runs `worker` over `items` with at most `concurrency` in flight. Results keep input order. */
export async function mapLimit<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}
