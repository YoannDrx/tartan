import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const variants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors disabled:opacity-50 no-underline",
  {
    variants: {
      variant: {
        // Blanc sur le rouge, rouge piste sur l'encre et la craie : le fond décide (globals.css).
        primary: "bg-cta text-on-cta hover:bg-cta-hover rounded-full",
        secondary:
          "bg-second text-inherit border-[length:var(--ctx-second-width)] border-second-line hover:bg-second-hover rounded-full",
        quiet: "text-inherit hover:bg-raise rounded-full",
        danger: "bg-transparent text-st-missed border border-st-missed hover:bg-raise rounded-full",
        darkPrimary: "bg-cta text-on-cta hover:bg-cta-hover rounded-full",
        darkSecondary:
          "bg-second text-inherit border-[length:var(--ctx-second-width)] border-second-line hover:bg-second-hover rounded-full",
        inverse: "bg-white text-ink hover:bg-hero rounded-full",
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
        plain: "rounded-button text-inherit hover:bg-raise",
        brand: "rounded-full bg-cta text-on-cta hover:bg-cta-hover",
        dark: "rounded-button bg-card-raised text-fg hover:bg-card-line",
        darkRound: "rounded-full bg-card-raised text-fg hover:bg-card-line",
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
