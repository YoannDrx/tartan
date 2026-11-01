import type { MetadataRoute } from "next";
import { m } from "@tartan/i18n";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: m.brand.storeName,
    short_name: m.brand.name,
    description: m.brand.tagline,
    lang: "fr",
    start_url: "/accueil",
    display: "standalone",
    background_color: "#F2F3F1",
    theme_color: "#C4442B",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
