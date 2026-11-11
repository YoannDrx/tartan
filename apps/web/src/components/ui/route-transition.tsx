"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PageTransition } from "@/components/ui/view-transition";

// Le contenu qui change avec l'adresse : d'une page à l'autre, il passe par le fondu de page.
// Un changement de paramètres de recherche (un mois, un filtre) n'est pas un changement de page.
export const RouteTransition = ({ children, className }: { children: ReactNode; className?: string }) => {
  const pathname = usePathname();
  return (
    <PageTransition key={pathname}>
      <div className={className}>{children}</div>
    </PageTransition>
  );
};
