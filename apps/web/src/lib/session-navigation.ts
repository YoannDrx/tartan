import { isoDate, uuid } from "@tartan/contracts";

// Le contexte de retour ne permet jamais de naviguer vers une URL libre.
// Une adresse partagée reste autonome : elle ne dépend pas de l'historique du navigateur.
export const sessionReturnTo = (value: unknown): string | undefined => {
  if (typeof value !== "string" || value.length > 1000 || !/^\/(calendrier|suivi)(\?|$)/.test(value)) return;
  const url = new URL(value, "https://tartan.invalid");
  if (url.hash || !["/calendrier", "/suivi"].includes(url.pathname)) return;
  const query = new URLSearchParams();
  const week = url.searchParams.get("semaine");
  const group = url.searchParams.get("groupe");
  const month = url.searchParams.get("mois");
  if (isoDate.safeParse(week).success) query.set("semaine", week!);
  if (uuid.safeParse(group).success) query.set("groupe", group!);
  if (url.pathname === "/calendrier" && url.searchParams.get("vue") === "mois") {
    query.set("vue", "mois");
    if (month && /^\d{4}-\d{2}$/.test(month) && isoDate.safeParse(`${month}-01`).success) query.set("mois", month);
  }
  return `${url.pathname}${query.size ? `?${query}` : ""}`;
};

export const withSessionReturn = (path: string, returnTo: unknown): string => {
  const context = sessionReturnTo(returnTo);
  if (!context) return path;
  const url = new URL(path, "https://tartan.invalid");
  url.searchParams.set("retour", context);
  return `${url.pathname}${url.search}${url.hash}`;
};

export const newSessionHref = ({ date, groupId, returnTo }: { date?: string; groupId?: string; returnTo?: string }) => {
  const query = new URLSearchParams();
  if (isoDate.safeParse(date).success) query.set("date", date!);
  if (uuid.safeParse(groupId).success) query.set("groupe", groupId!);
  return withSessionReturn(`/seances/nouvelle${query.size ? `?${query}` : ""}`, returnTo);
};

export const calendarSessionHref = (sessionId: string, returnTo?: string): string => {
  const context = sessionReturnTo(returnTo);
  if (!context?.startsWith("/calendrier")) return withSessionReturn(`/seances/${sessionId}/suivi`, returnTo);
  const url = new URL(context, "https://tartan.invalid");
  url.searchParams.set("seance", sessionId);
  return `${url.pathname}${url.search}`;
};
