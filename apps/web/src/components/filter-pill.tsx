import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const pillClass = (active: boolean) =>
  cn(
    "inline-flex min-h-9 items-center whitespace-nowrap rounded-full px-3.5 text-[14px] no-underline before:absolute before:inset-x-0 before:-inset-y-1 relative",
    active ? "bg-ink font-semibold text-white" : "border border-[#D4D5D2] bg-surface font-medium text-ink hover:bg-bg",
  );

export const FilterPill = ({ active, className, ...props }: ComponentProps<typeof Link> & { active: boolean }) => (
  <Link aria-current={active ? "true" : undefined} className={cn(pillClass(active), className)} {...props} />
);
