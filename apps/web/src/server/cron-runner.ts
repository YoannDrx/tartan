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
    }
  }
  return { ...results, errors };
};
