import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const variants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors disabled:opacity-50 no-underline",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white hover:bg-brand-strong rounded-full",
        secondary: "bg-surface text-ink border border-border hover:bg-bg rounded-full",
        quiet: "text-ink hover:bg-surface-sunk rounded-full",
        danger: "bg-surface text-brand-strong border border-brand-strong hover:bg-brand-tint rounded-full",
        darkPrimary: "bg-brand text-white hover:bg-brand-strong rounded-full",
        darkSecondary: "bg-ink text-white border border-ink-3 hover:bg-ink-2 rounded-full",
        inverse: "bg-ink text-white hover:bg-ink-2 rounded-full",
      },
      size: {
        lg: "min-h-[52px] px-6 text-base",
        md: "min-h-[48px] px-5 text-base",
        sm: "min-h-[44px] px-4 text-[15px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Props = ComponentProps<"button"> & VariantProps<typeof variants> & { asChild?: boolean };

export const Button = ({ className, variant, size, asChild, type, ...props }: Props) => {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      type={asChild ? undefined : (type ?? "button")}
      className={cn(variants({ variant, size }), className)}
      {...props}
    />
  );
};

const iconVariants = cva(
  "inline-flex size-11 shrink-0 items-center justify-center transition-colors disabled:opacity-50",
  {
    variants: {
      tone: {
        plain: "rounded-button text-ink hover:bg-surface-sunk",
        brand: "rounded-full bg-brand text-white hover:bg-brand-strong",
        dark: "rounded-button bg-ink-2 text-white hover:bg-ink-3",
        darkRound: "rounded-full bg-ink-2 text-white hover:bg-ink-3",
      },
    },
    defaultVariants: { tone: "plain" },
  },
);

// Le libellé accessible est obligatoire (§ 9.8) : `label` est requis par le typage.
export const IconButton = ({
  label,
  tone,
  className,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof iconVariants> & { label: string }) => (
  <button type="button" aria-label={label} title={label} className={cn(iconVariants({ tone }), className)} {...props} />
);
