import type { Metadata } from "next";

import { Sidebar } from "@/components/admin/sidebar";

export const metadata: Metadata = {
  title: "Spinvincible Admin",
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-screen bg-canvas p-3 sm:p-6 lg:p-10">
      <div className="mx-auto flex max-w-[1440px] flex-col overflow-hidden rounded-[28px] bg-panel shadow-sm lg:min-h-[calc(100vh-5rem)] lg:flex-row">
        <Sidebar />
        <main className="min-w-0 flex-1 p-5 sm:p-8 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
