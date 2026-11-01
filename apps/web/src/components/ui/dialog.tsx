"use client";

import { X } from "lucide-react";
import { Dialog as Radix } from "radix-ui";
import type { ReactNode } from "react";
import { m } from "@tartan/i18n";
import { cn } from "@/lib/cn";

export const Dialog = ({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
  wide,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  trigger?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) => (
  <Radix.Root open={open} onOpenChange={onOpenChange}>
    {trigger ? <Radix.Trigger asChild>{trigger}</Radix.Trigger> : null}
    <Radix.Portal>
      <Radix.Overlay className="fixed inset-0 z-40 bg-ink/50" />
      <Radix.Content
        aria-describedby={description ? undefined : undefined}
        className={cn(
          "fixed z-50 flex max-h-[92dvh] flex-col overflow-y-auto bg-surface shadow-[0_8px_24px_rgba(21,22,26,0.16)]",
          "inset-x-0 bottom-0 rounded-t-hero p-4 pb-[max(16px,env(safe-area-inset-bottom))]",
          "tablet:inset-auto tablet:left-1/2 tablet:top-1/2 tablet:w-full tablet:-translate-x-1/2 tablet:-translate-y-1/2 tablet:rounded-hero tablet:p-6",
          wide ? "tablet:max-w-[720px]" : "tablet:max-w-[480px]",
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <Radix.Title className="t-h2">{title}</Radix.Title>
            {description ? (
              <Radix.Description className="mt-1 text-muted">{description}</Radix.Description>
            ) : (
              <Radix.Description className="sr-only">{title}</Radix.Description>
            )}
          </div>
          <Radix.Close
            aria-label={m.common.close}
            className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-button hover:bg-surface-sunk"
          >
            <X aria-hidden className="size-5" />
          </Radix.Close>
        </div>
        {children}
      </Radix.Content>
    </Radix.Portal>
  </Radix.Root>
);
