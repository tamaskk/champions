import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Repo root (packages/pipeline/src → ../../..). */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Where raw downloads are cached. Gitignored: never commit scraped raw data. */
export const RAW_DIR = path.join(REPO_ROOT, "data/raw");

/** Curated, committed pipeline data (id maps, aliases). */
export const PIPELINE_DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data");

/**
 * Same env files as the web app: apps/web/.env.local first, then the repo-root .env.
 * process.loadEnvFile never overwrites a variable that is already set, so the shell wins,
 * then .env.local, then .env.
 */
export function loadEnv() {
  for (const file of ["apps/web/.env.local", ".env"]) {
    const full = path.join(REPO_ROOT, file);
    if (existsSync(full)) process.loadEnvFile(full);
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Add it to the repo-root .env or apps/web/.env.local (see .env.example).`);
  }
  return value;
}
