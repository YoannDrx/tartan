import { ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full min-h-11 rounded-[10px] border border-control-line bg-transparent px-3 text-[16px] text-inherit placeholder:text-fg-muted hover:border-fg-muted disabled:opacity-60 aria-invalid:border-st-missed file:mr-3 file:min-h-8 file:cursor-pointer file:rounded-full file:border-0 file:bg-card-raised file:px-3 file:text-[14px] file:font-semibold file:text-inherit";

export const Input = ({ className, ...props }: ComponentProps<"input">) => (
  <input className={cn(control, className)} {...props} />
);

export const Textarea = ({ className, ...props }: ComponentProps<"textarea">) => (
  <textarea className={cn(control, "py-2 min-h-24", className)} {...props} />
);

export const Select = ({ className, ...props }: ComponentProps<"select">) => (
  <span className="relative block w-full">
    <select className={cn(control, "appearance-none pr-9", className)} {...props} />
    <ChevronDown
      aria-hidden
      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-soft"
    />
  </span>
);

export const Field = ({
  label,
  hint,
  error,
  className,
  children,
  labelHidden,
}: {
  label: string;
  labelHidden?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}) => {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={labelHidden ? "sr-only" : "t-caption text-inherit"}>
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && !error ? (
        <p id={`${id}-hint`} className="t-caption text-soft font-normal">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="t-caption text-alert">
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
    <input type="checkbox" className="check mt-px" {...props} />
    <span className="flex flex-col">
      <span>{label}</span>
      {detail ? <span className="t-caption text-soft font-normal">{detail}</span> : null}
    </span>
  </label>
);
