import type { MetadataRoute } from "next";

const PAGES = ["", "/tarifs", "/contact", "/confidentialite", "/conditions", "/cgv", "/mentions-legales"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({ url: `https://tartan.coach${path}` }));
}
