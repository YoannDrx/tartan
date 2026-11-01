import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const EmptyState = ({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex flex-col items-start gap-3 rounded-block border border-dashed border-status-upcoming p-6",
      className,
    )}
  >
    <p className="max-w-prose">{children}</p>
    {action}
  </div>
);

export const PageHeader = ({ title, detail, actions }: { title: string; detail?: ReactNode; actions?: ReactNode }) => (
  <header className="flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0">
      {detail ? <p className="text-muted">{detail}</p> : null}
      <h1 className="t-display">{title}</h1>
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </header>
);

export const Chip = ({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "dark" | "brand" | "warning";
}) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 t-caption font-semibold",
      tone === "neutral" && "bg-bg text-muted",
      tone === "dark" && "bg-ink-2 text-white",
      tone === "brand" && "bg-brand-tint text-brand-strong",
      tone === "warning" && "bg-warning-tint text-warning-strong",
    )}
  >
    {children}
  </span>
);

export const Spinner = ({ label }: { label: string }) => (
  <p role="status" className="py-8 text-center text-muted">
    {label}
  </p>
);
