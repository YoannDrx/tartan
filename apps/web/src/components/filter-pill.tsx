import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Une pastille de filtre est une cible principale : 44 px de haut, la taille que demande `DESIGN.md`, dessinée et pas
// seulement prolongée par une marge invisible.
export const pillClass = (active: boolean) =>
  cn(
    "inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-[14px] no-underline",
    active
      ? "bg-accent font-semibold text-on-accent"
      : "border border-pill-line bg-pill-off font-medium text-inherit hover:bg-raise",
  );

export const FilterPill = ({ active, className, ...props }: ComponentProps<typeof Link> & { active: boolean }) => (
  <Link aria-current={active ? "true" : undefined} className={cn(pillClass(active), className)} {...props} />
);
