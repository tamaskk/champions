"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { adminLogout } from "@/app/admin-login/actions";

import { CalendarIcon, DownloadIcon, FileIcon, GridIcon, ShieldIcon, TrophyIcon, UploadIcon, UsersIcon } from "./icons";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: GridIcon },
  { href: "/admin/clubs", label: "Clubs", icon: ShieldIcon },
  { href: "/admin/players", label: "Players", icon: UsersIcon },
  { href: "/admin/import", label: "Import", icon: UploadIcon },
  { href: "/admin/daily", label: "Daily challenges", icon: CalendarIcon },
  { href: "/admin/coins", label: "Coins", icon: TrophyIcon },
  { href: "/admin/waitlist", label: "Waitlist", icon: UsersIcon },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-full shrink-0 flex-col gap-8 border-b border-line bg-white/60 p-6 lg:w-64 lg:border-r lg:border-b-0">
      <Link href="/admin" className="flex items-center gap-2.5">
        <Image src="/logo.png" alt="" width={32} height={32} className="size-8 rounded-lg" />
        <span className="text-lg font-semibold tracking-tight text-ink">Spinvincible</span>
      </Link>

      <nav className="flex flex-col gap-1">
        <p className="mb-2 px-3 text-xs font-medium tracking-widest text-muted uppercase">Main</p>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                active ? "bg-canvas font-semibold text-ink" : "text-muted hover:bg-canvas/60 hover:text-ink"
              }`}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>

      <form action={adminLogout}>
        <button className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-muted hover:bg-canvas/60 hover:text-ink">
          Sign out
        </button>
      </form>

      <div className="mt-auto hidden rounded-2xl bg-canvas/70 p-5 lg:block">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <FileIcon className="text-accent" />
          Import format
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Clubs are imported as JSON, one entry per league season.
        </p>
        <a
          href="/admin/import/sample"
          download
          className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-ink/90"
        >
          <DownloadIcon />
          Sample JSON
        </a>
      </div>
    </aside>
  );
}
