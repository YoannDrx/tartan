"use client";

import { m } from "@tartan/i18n";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { markInstallOpportunity } from "@/features/shell/install-opportunity";

const seenKey = (organizationId: string) => `tartan.welcome-seen.${organizationId}`;

const alreadySeen = (organizationId: string): boolean => {
  try {
    return localStorage.getItem(seenKey(organizationId)) === "true";
  } catch {
    return false;
  }
};

// L'arrivée d'un athlète dans le groupe : qui l'a invité, ce qui va se passer ici, et rien de plus.
// L'installation et les notifications se proposent dès maintenant, sans attendre une première validation.
export const AthleteWelcome = ({
  organizationId,
  group,
  coach,
}: {
  organizationId: string;
  group: string;
  coach: string;
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Après le premier rendu : le serveur ne sait pas ce que ce téléphone a déjà refermé.
    const first = setTimeout(() => {
      if (alreadySeen(organizationId)) return;
      setOpen(true);
      markInstallOpportunity();
    }, 0);
    return () => clearTimeout(first);
  }, [organizationId]);

  if (!open) return null;
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(seenKey(organizationId), "true");
    } catch {
      // Stockage refusé : l'accueil reviendra à la prochaine visite, sans conséquence.
    }
  };

  return (
    // Sans mascotte : l'état vide juste dessous porte déjà la sienne.
    <section aria-labelledby="bienvenue" className="flex flex-col items-start gap-3 rounded-card on-card bg-card p-5">
      <h2 id="bienvenue" className="t-h2 text-balance">
        {m.athleteWelcome.title(group)}
      </h2>
      <p className="max-w-prose">{m.athleteWelcome.body(coach)}</p>
      <Button type="button" variant="secondary" size="md" onClick={close}>
        {m.athleteWelcome.dismiss}
      </Button>
    </section>
  );
};
