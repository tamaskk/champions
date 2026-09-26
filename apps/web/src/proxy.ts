import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_COOKIE, verifyAdminSession } from "@/server/admin-auth";

/** Every /admin page needs a valid admin session; otherwise → the login page. */
export async function proxy(request: NextRequest) {
  if (await verifyAdminSession(request.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.next();
  const login = new URL("/admin-login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
