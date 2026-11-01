import Image from "next/image";

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
