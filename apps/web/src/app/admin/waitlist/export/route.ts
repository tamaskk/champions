import { cookies } from "next/headers";

import { ADMIN_COOKIE, verifyAdminSession } from "@/server/admin-auth";
import { allWaitlist } from "@/server/waitlist-data";

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** GET /admin/waitlist/export – every sign-up as CSV (admin only; proxy.ts guards /admin too). */
export async function GET() {
  if (!(await verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const rows = await allWaitlist();
  const csv = [
    "email,signed_up_utc,form,language",
    ...rows.map((r) => [r.email, r.createdAt.toISOString(), r.source, r.locale ?? ""].map(csvCell).join(",")),
  ].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="spinvincible-waitlist-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
