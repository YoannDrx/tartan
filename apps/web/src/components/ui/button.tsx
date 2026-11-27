import { cva, type VariantProps } from "class-variance-authority";
import type { FeedbackCue } from "@tartan/design-tokens";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// La pression se sent : le bouton s'enfonce un instant (sauf en mouvement réduit) et joue son retour
// (`lib/feedback.ts`, « tap » par défaut, « off » pour se taire).
const press =
  "transition-[color,background-color,border-color,transform] duration-(--duration-instant) ease-reception active:scale-[0.97] motion-reduce:active:scale-100";

type Feedback = { feedback?: FeedbackCue | "off" };

const variants = cva(
  `inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold disabled:opacity-50 no-underline ${press}`,
  {
    variants: {
      variant: {
        // Citron sur les fonds soutenus et l'encre, encre sur la craie et le soleil : le fond décide (globals.css).
        primary: "bg-cta text-on-cta hover:bg-cta-hover rounded-full",
        secondary:
          "bg-second text-inherit border-[length:var(--ctx-second-width)] border-second-line hover:bg-second-hover rounded-full",
        quiet: "text-inherit hover:bg-raise rounded-full",
        danger: "bg-transparent text-danger border border-danger hover:bg-raise rounded-full",
        darkPrimary: "bg-cta text-on-cta hover:bg-cta-hover rounded-full",
        darkSecondary:
          "bg-second text-inherit border-[length:var(--ctx-second-width)] border-second-line hover:bg-second-hover rounded-full",
        inverse: "bg-accent text-on-accent hover:bg-hero rounded-full",
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

type Props = ComponentProps<"button"> & VariantProps<typeof variants> & { asChild?: boolean } & Feedback;

export const Button = ({ className, variant, size, asChild, type, feedback = "tap", ...props }: Props) => {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      type={asChild ? undefined : (type ?? "button")}
      data-feedback={feedback}
      className={cn(variants({ variant, size }), className)}
      {...props}
    />
  );
};

const iconVariants = cva(
  `inline-flex size-11 shrink-0 items-center justify-center disabled:opacity-50 ${press}`,
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
  feedback = "tap",
  ...props
}: ComponentProps<"button"> & VariantProps<typeof iconVariants> & { label: string } & Feedback) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    data-feedback={feedback}
    className={cn(iconVariants({ tone }), className)}
    {...props}
  />
);
