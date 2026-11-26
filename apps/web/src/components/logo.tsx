import { w } from "@tartan/i18n/web";
import Image from "next/image";
import { cn } from "@/lib/cn";

export const LogoMark = ({ size = 32 }: { size?: number }) => (
  <Image src={size < 32 ? "/brand/icon-small.svg" : "/brand/icon.svg"} alt="" width={size} height={size} unoptimized />
);

export const Logo = ({ height = 32, onDark = false }: { height?: number; onDark?: boolean }) => (
  <Image
    src={onDark ? "/brand/logo-on-dark.svg" : "/brand/logo.svg"}
    alt={w.shell.brand}
    width={Math.round((height * 408) / 107)}
    height={height}
    unoptimized
    priority
  />
);

// Le mot « Tartan » dont le T est la marque (décision du fondateur du 23 novembre 2026). Ses deux masques viennent de
// `scripts/build-logo.mjs` ; `.wordmark` (globals.css) les peint dans la couleur du texte de la page, la ligne
// d'arrivée en citron sur la piste et l'encre, d'une seule couleur sur un fond clair (DESIGN.md, Logo). Un seul nom
// pour les lecteurs d'écran : « Tartan ».
export const Wordmark = ({ className }: { className?: string }) => (
  <span role="img" aria-label={w.shell.brand} className={cn("wordmark text-on-page", className)} />
);
