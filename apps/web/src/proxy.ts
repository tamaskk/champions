import { NextResponse, type NextRequest } from "next/server";

import { isAdminAuthorized } from "@/server/admin-auth";

export function proxy(request: NextRequest) {
  if (isAdminAuthorized(request.headers.get("authorization"))) return NextResponse.next();
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Champion admin", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
