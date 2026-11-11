import type { ReactNode } from "react";
import { RouteTransition } from "@/components/ui/route-transition";

// D'une page du site à l'autre, le contenu passe par le fondu de page ; l'en-tête, lui, reste en place.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <RouteTransition>{children}</RouteTransition>;
}
