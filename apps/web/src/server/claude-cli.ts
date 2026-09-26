import "server-only";

import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

/**
 * Runs the local Claude Code CLI headless (`claude -p`) with web search and returns its
 * schema-validated JSON answer. Uses the CLI's own login (claude.ai subscription), never an API
 * key. Only for local development: Vercel has no `claude` binary.
 */
export const LOCAL_CLAUDE_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.ENABLE_LOCAL_CLAUDE === "1";

const TIMEOUT_MS = 10 * 60 * 1000;

export type ClaudeResult = { ok: true; data: unknown } | { ok: false; error: string };

export function askClaude(prompt: string, schema: object): Promise<ClaudeResult> {
  const args = [
    "-p",
    prompt,
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(schema),
    "--allowedTools",
    "WebSearch",
    "WebFetch",
    "--permission-mode",
    "dontAsk",
    "--no-session-persistence",
    "--strict-mcp-config",
    ...(process.env.CLAUDE_SQUAD_MODEL ? ["--model", process.env.CLAUDE_SQUAD_MODEL] : []),
  ];

  // An API key in the environment would make the CLI bill the API instead of the subscription.
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;

  return new Promise((resolve) => {
    // No shell: arguments are passed verbatim, so club names can't inject commands.
    // Run outside the repo so the project's CLAUDE.md and hooks don't apply.
    const child = spawn(process.env.CLAUDE_BIN || "claude", args, {
      cwd: tmpdir(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), TIMEOUT_MS);

    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `Could not start claude: ${error.message}` });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (signal) return resolve({ ok: false, error: `claude was stopped (${signal}), probably the timeout` });
      try {
        const out = JSON.parse(stdout);
        if (out.is_error || out.structured_output === undefined) {
          return resolve({ ok: false, error: `claude failed: ${out.subtype ?? ""} ${out.result ?? ""}`.trim() });
        }
        resolve({ ok: true, data: out.structured_output });
      } catch {
        resolve({ ok: false, error: `claude exited with ${code}: ${(stderr || stdout).slice(0, 500)}` });
      }
    });
  });
}
