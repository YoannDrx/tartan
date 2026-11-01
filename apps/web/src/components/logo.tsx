import Image from "next/image";
import { cn } from "@/lib/cn";

export const LogoMark = ({ size = 32 }: { size?: number }) => (
  <Image src={size < 32 ? "/brand/icon-small.svg" : "/brand/icon.svg"} alt="" width={size} height={size} unoptimized />
);

export const Logo = ({ height = 32, onDark = false }: { height?: number; onDark?: boolean }) => (
  <Image
    src={onDark ? "/brand/logo-on-dark.svg" : "/brand/logo.svg"}
    alt="Tartan"
    width={Math.round((height * 573) / 160)}
    height={height}
    unoptimized
    priority
  />
);

// Sur le rouge, le logotype blanc seul : l'icône rouge s'y perdrait (DESIGN.md).
export const Wordmark = ({ className }: { className?: string }) => (
  <span className={cn("font-display text-[34px] font-bold leading-none text-on-page", className)}>Tartan</span>
);
