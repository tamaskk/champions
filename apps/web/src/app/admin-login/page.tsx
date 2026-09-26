import type { Metadata } from "next";

import { adminConfigured } from "@/server/admin-auth";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Champion Admin · Sign in" };

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin-login">) {
  const { next } = await searchParams;
  return (
    <div className="grid min-h-screen place-items-center bg-canvas p-6">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-bold text-white">82</span>
          <span className="text-lg font-semibold tracking-tight text-ink">Champion Admin</span>
        </div>
        {adminConfigured() ? (
          <LoginForm next={typeof next === "string" ? next : "/admin"} />
        ) : (
          <p className="text-sm text-muted">
            Admin login is not set up. Add <code className="font-mono text-ink">ADMIN_USER</code>,{" "}
            <code className="font-mono text-ink">ADMIN_PASSWORD</code> and{" "}
            <code className="font-mono text-ink">ADMIN_SESSION_SECRET</code> to <code className="font-mono text-ink">.env</code>{" "}
            and restart the server.
          </p>
        )}
      </div>
    </div>
  );
}
