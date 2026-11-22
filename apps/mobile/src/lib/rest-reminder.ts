// Le rappel de fin de récupération du mode séance, quand l'app passe en arrière-plan : une notification locale à
// l'heure de fin, retirée dès que l'app revient au premier plan (la vibration et le compte à rebours y suffisent).
// Module pur : l'écran lui donne de quoi programmer et retirer, les tests le font sans téléphone.

// Moins d'une seconde avant la fin, la notification arriverait après le retour : on ne programme rien.
export const REST_REMINDER_MIN_MS = 1000;

export type RestReminderDeps = {
  // Programme la notification à l'heure donnée ; rend son identifiant, ou null si l'appareil la refuse.
  schedule: (at: number) => Promise<string | null>;
  cancel: (id: string) => Promise<void>;
};

export const createRestReminder = (deps: RestReminderDeps) => {
  let scheduled: string | null = null;
  // Chaque changement d'état invalide une programmation encore en vol : une réponse tardive est aussitôt retirée.
  let generation = 0;

  const clear = async () => {
    generation += 1;
    const id = scheduled;
    scheduled = null;
    if (id) await deps.cancel(id).catch(() => undefined);
  };

  return {
    /** L'app quitte le premier plan, la récupération finit à `endAt` (null : aucune récupération en cours). */
    background: async (endAt: number | null, now: number) => {
      if (endAt === null || endAt - now < REST_REMINDER_MIN_MS || scheduled) return;
      const mine = ++generation;
      const id = await deps.schedule(endAt).catch(() => null);
      if (!id) return;
      if (mine !== generation) {
        await deps.cancel(id).catch(() => undefined);
        return;
      }
      scheduled = id;
    },
    /** Retour au premier plan, récupération arrêtée ou terminée, écran quitté : plus de rappel. */
    clear,
    scheduledId: () => scheduled,
  };
};

export type RestReminder = ReturnType<typeof createRestReminder>;
