import * as Sentry from "@sentry/nextjs";
import { log } from "@/lib/logger";

// Une tâche en panne doit être visible, sans empêcher les autres services de fonctionner.
export const runCronJobs = async <T extends Record<string, () => Promise<unknown>>>(jobs: T) => {
  const results = {} as { [K in keyof T]: Awaited<ReturnType<T[K]>> | null };
  const errors: string[] = [];
  for (const name of Object.keys(jobs) as (keyof T & string)[]) {
    try {
      results[name] = (await jobs[name]!()) as Awaited<ReturnType<T[typeof name]>>;
    } catch {
      results[name] = null;
      errors.push(name);
      log.error("cron_job_failed", { code: name });
      // Le nom de la tâche suffit : l'objet d'erreur pourrait contenir des données personnelles.
      Sentry.captureMessage("cron_job_failed", { level: "error", tags: { job: name } });
    }
  }
  // Une fonction Vercel peut se figer dès la réponse : sans cela, l'alerte serait perdue.
  if (errors.length) await Sentry.flush(2000);
  return { ...results, errors };
};
