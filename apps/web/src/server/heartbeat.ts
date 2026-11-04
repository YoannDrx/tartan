import { env } from "@/lib/env";
import { log } from "@/lib/logger";

type HeartbeatJob = "hourly" | "notifications";

// Signal de vie vers la sonde externe : une tâche silencieuse ou en erreur déclenche l'alerte.
export const sendHeartbeat = async (job: HeartbeatJob, errors: readonly string[] = []): Promise<void> => {
  if (errors.length) return;
  const { CRON_HEARTBEAT_URL, CRON_HEARTBEAT_NOTIFICATIONS_URL } = env();
  // Une seule adresse pour les deux masquerait une panne de la tâche horaire.
  const url = job === "hourly" ? CRON_HEARTBEAT_URL : CRON_HEARTBEAT_NOTIFICATIONS_URL;
  if (!url) return;
  try {
    await fetch(url, { method: "GET", signal: AbortSignal.timeout(5000) });
  } catch {
    // La sonde constatera l'absence de signal : la tâche, elle, a réussi.
    log.warn("cron_heartbeat_failed", { code: job });
  }
};
