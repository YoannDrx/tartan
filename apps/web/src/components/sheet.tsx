import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

// La feuille : une seule surface réglée, comme une feuille de concours. Des lignes plutôt que des cartes.
export const Sheet = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("overflow-hidden rounded-card on-card bg-card", className)} {...props} />
);

export const SheetSection = ({
  title,
  action,
  aside,
  children,
  className,
  id,
  flush,
}: {
  title: string;
  action?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  flush?: boolean;
}) => {
  const titleId = useId();
  return (
    <section id={id} aria-labelledby={titleId} className={cn("scroll-mt-20 py-3", className)}>
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4">
        <h2 id={titleId} className="t-h2 flex flex-wrap items-baseline gap-x-2">
          {title}
          {aside}
        </h2>
        {action}
      </div>
      <div className={cn("mt-1", !flush && "px-4 pb-1")}>{children}</div>
    </section>
  );
};

export const Rows = ({ className, ...props }: ComponentProps<"ul">) => (
  <ul className={cn("divide-y divide-card-line", className)} {...props} />
);

// Valeur chiffrée d'une feuille : alignée à droite, en chiffres tabulaires.
export const Mark = ({ className, ...props }: ComponentProps<"span">) => (
  <span className={cn("t-num whitespace-nowrap text-right text-[22px] leading-7", className)} {...props} />
);
