import type { ComponentType, ReactNode, SVGProps } from "react";

import { AlertIcon } from "./icons";

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </header>
  );
}

export function Card({
  title,
  icon: Icon,
  action,
  className = "",
  children,
}: {
  title?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}>
      {title && (
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2.5 font-semibold text-ink">
            {Icon && <Icon className="text-muted" />}
            {title}
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const TONES = {
  indigo: "bg-accent-soft text-accent",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-500",
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: keyof typeof TONES;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <span className={`grid size-11 shrink-0 place-items-center rounded-full ${TONES[tone]}`}>
        <Icon />
      </span>
      <div>
        <p className="text-sm text-muted">{label}</p>
        <p className="text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
      </div>
    </div>
  );
}

export function Badge({ children, tone = "indigo" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink hover:bg-panel",
};

export function DbError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <Card>
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-500">
          <AlertIcon />
        </span>
        <div>
          <p className="font-semibold text-ink">Database not available</p>
          <p className="mt-1 text-sm text-muted">{message}</p>
          <p className="mt-3 text-sm text-muted">
            Set <code className="rounded bg-panel px-1.5 py-0.5 font-mono text-ink">MONGODB_URI</code> in{" "}
            <code className="rounded bg-panel px-1.5 py-0.5 font-mono text-ink">apps/web/.env.local</code> and restart the
            dev server.
          </p>
        </div>
      </div>
    </Card>
  );
}
