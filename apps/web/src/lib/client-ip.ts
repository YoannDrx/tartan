// L'adresse du visiteur, telle que Vercel la transmet : la première de x-forwarded-for. Elle ne sert qu'à une
// empreinte salée (limitation de débit, abus), jamais conservée en clair.
export const clientIp = (request: Request): string =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
