// Les notifications portent le chemin du site : on le traduit en route de l'app.
// Rien du contenu n'est utilisé tel quel comme route.

export type NotificationData = {
  type?: unknown;
  link?: unknown;
  organizationId?: unknown;
  sessionId?: unknown;
  videoId?: unknown;
};

const ID = /^[A-Za-z0-9-]{8,64}$/;

export const routeForNotification = (data: NotificationData | null | undefined): string => {
  const link = typeof data?.link === "string" ? data.link : "";
  const video = link.match(/^\/(?:mes-sauts|videos)\/([^/?#]+)/)?.[1];
  if (video && ID.test(video)) return `/video/${video}`;
  const coachSession = link.match(/^\/seances\/([^/?#]+)/)?.[1];
  if (coachSession && ID.test(coachSession)) return `/coach-session/${coachSession}`;
  // « /seance/… » ouvre Aujourd'hui, d'où la validation se fait en deux touches.
  if (link.startsWith("/seance/")) return "/today";
  if (link.startsWith("/athletes")) return "/tracking";
  return "/";
};

export type NotificationAction =
  | { kind: "attendance"; status: "present" | "absent"; orgId: string; sessionId: string }
  | { kind: "validate"; orgId: string; sessionId: string };

export const actionFromResponse = (
  actionId: string,
  data: NotificationData | null | undefined,
): NotificationAction | null => {
  const orgId = typeof data?.organizationId === "string" ? data.organizationId : null;
  const sessionId = typeof data?.sessionId === "string" ? data.sessionId : null;
  if (!orgId || !sessionId) return null;
  if (actionId === "attendance-yes") return { kind: "attendance", status: "present", orgId, sessionId };
  if (actionId === "attendance-no") return { kind: "attendance", status: "absent", orgId, sessionId };
  if (actionId === "validate-done") return { kind: "validate", orgId, sessionId };
  return null;
};
