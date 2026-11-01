import type { MetadataRoute } from "next";
import { tokens } from "@tartan/design-tokens";
import { m } from "@tartan/i18n";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: m.brand.storeName,
    short_name: m.brand.name,
    description: m.brand.tagline,
    lang: "fr",
    start_url: "/accueil",
    display: "standalone",
    background_color: tokens.scene.page,
    theme_color: tokens.scene.page,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
