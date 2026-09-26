import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { RAW_DIR } from "./env";

/** Writes a JSON run report under data/raw/reports/ (gitignored) and returns its path. */
export async function writeReport(name: string, data: unknown): Promise<string> {
  const dir = path.join(RAW_DIR, "reports");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
  return path.relative(process.cwd(), file);
}

export const pct = (part: number, whole: number) => (whole ? `${Math.round((100 * part) / whole)}%` : "–");
