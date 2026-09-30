"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_COOKIE,
  adminConfigured,
  checkAdminCredentials,
  createAdminSession,
} from "@/server/admin-auth";
import { enforceRateLimit } from "@/server/rate-limit";

export type LoginState = { error: string | null };

/** Only admin paths: a login link can't send you anywhere else. */
const safeNext = (next: unknown) =>
  typeof next === "string" && /^\/admin(\/|$|\?)/.test(next) ? next : "/admin";

export async function adminLogin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!adminConfigured()) return { error: "Admin login is not set up: add ADMIN_USER and ADMIN_PASSWORD to .env" };
  // At most 10 tries per IP every 15 minutes (the password can't be guessed by brute force).
  try {
    await enforceRateLimit("admin-login", await headers(), null);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Too many attempts" };
  }
  const user = String(formData.get("user") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!checkAdminCredentials(user, password)) {
    // Slow down password guessing.
    await new Promise((r) => setTimeout(r, 800));
    return { error: "Wrong username or password" };
  }
  const session = await createAdminSession();
  (await cookies()).set(ADMIN_COOKIE, session.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expires,
  });
  redirect(safeNext(formData.get("next")));
}

export async function adminLogout() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin-login");
}
