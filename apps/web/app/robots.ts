import type { MetadataRoute } from "next";

// Seul le site se référence : l'application reste derrière sa connexion.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/$", "/tarifs", "/contact", "/confidentialite", "/conditions", "/cgv", "/mentions-legales", "/brand/"],
      disallow: ["/"],
    },
    sitemap: "https://tartan.coach/sitemap.xml",
  };
}
