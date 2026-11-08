import type { NotificationType } from "./notifications";

// Numéro comparable en base : 1.12.3 donne 1012003. Une version mal formée reste inconnue.
export const versionCode = (version: string | null | undefined): number | null => {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(version?.trim() ?? "");
  if (!match) return null;
  return Number(match[1]) * 1_000_000 + Number(match[2]) * 1_000 + Number(match[3]);
};

export const compareVersions = (a: string | null | undefined, b: string | null | undefined): number =>
  (versionCode(a) ?? 0) - (versionCode(b) ?? 0);

export type UpdateState = "current" | "optional" | "required";

export const updateStateOf = (input: {
  current: string | null | undefined;
  latest?: string | null;
  minimum?: string | null;
}): UpdateState => {
  const current = versionCode(input.current);
  // Sans version lisible, on ne bloque jamais : au pire, l'athlète ne voit pas la proposition.
  if (current === null) return "current";
  const minimum = versionCode(input.minimum);
  if (minimum !== null && current < minimum) return "required";
  const latest = versionCode(input.latest);
  return latest !== null && current < latest ? "optional" : "current";
};

// Un redémarrage ne doit jamais couper une séance, une capture ni une file en cours d'envoi.
export const canRestart = (state: {
  uploading: boolean;
  capturing: boolean;
  inSession: boolean;
  syncing: boolean;
}): boolean => !state.uploading && !state.capturing && !state.inSession && !state.syncing;

export type NotificationCategory = "sessions" | "feedback" | "group" | "product" | "alerts";

export const notificationCategory = (type: NotificationType): NotificationCategory => {
  switch (type) {
    case "video_shared":
    case "comment":
      return "feedback";
    case "announcement":
    case "member_joined":
      return "group";
    case "pain_alert":
    case "missed_streak":
      return "alerts";
    case "app_update":
      return "product";
    default:
      return "sessions";
  }
};
