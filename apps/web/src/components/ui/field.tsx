import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full min-h-11 rounded-[10px] border border-border bg-surface px-3 text-[16px] text-ink placeholder:text-muted disabled:opacity-60 aria-invalid:border-brand-strong";

export const Input = ({ className, ...props }: ComponentProps<"input">) => (
  <input className={cn(control, className)} {...props} />
);

export const Textarea = ({ className, ...props }: ComponentProps<"textarea">) => (
  <textarea className={cn(control, "py-2 min-h-24", className)} {...props} />
);

export const Select = ({ className, ...props }: ComponentProps<"select">) => (
  <select className={cn(control, "pr-8", className)} {...props} />
);

export const Field = ({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}) => {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="t-caption text-ink">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && !error ? (
        <p id={`${id}-hint`} className="t-caption text-muted font-normal">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="t-caption text-brand-strong">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export const CheckRow = ({
  label,
  detail,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: string; detail?: string }) => (
  <label className={cn("flex min-h-11 items-start gap-3 py-2", className)}>
    <input type="checkbox" className="mt-0.5 size-5 shrink-0 rounded border-border accent-brand" {...props} />
    <span className="flex flex-col">
      <span>{label}</span>
      {detail ? <span className="t-caption text-muted font-normal">{detail}</span> : null}
    </span>
  </label>
);
