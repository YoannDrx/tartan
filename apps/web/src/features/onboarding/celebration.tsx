"use client";

import { w } from "@tartan/i18n/web";
import { ATHLETE_IDS } from "@tartan/mascot/athletes";
import { useEffect, useState, type CSSProperties } from "react";
import { Athlete } from "@/components/athlete";
import { FinishLine } from "@/components/track";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useOnboarding } from "./onboarding-context";

const t = w.onboarding.celebration;

// La fin des premiers pas, un des grands moments (DESIGN.md) : le groupe passe la ligne d'arrivée, un athlète après
// l'autre. Une seule fois : elle est notée dès l'affichage, sans attendre la fermeture. Rien n'est retenu derrière :
// le dialogue se referme d'un geste, l'écran dessous est déjà utilisable. En mouvement réduit, le groupe est déjà arrivé.
export const Celebration = () => {
  const [open, setOpen] = useState(true);
  const save = useOnboarding()?.save;
  useEffect(() => {
    save?.({ celebrated: true });
  }, [save]);
  return (
    <Dialog open={open} onOpenChange={setOpen} title={t.title} description={t.body}>
      <div aria-hidden className="relative h-36 overflow-hidden rounded-card bg-page tablet:h-44">
        <FinishLine className="absolute inset-x-0 bottom-[12%]" lanes={8} />
        <ul className="absolute inset-x-2 bottom-[14%] flex items-end justify-center gap-0.5">
          {ATHLETE_IDS.map((id, index) => (
            <li key={id} className="finish-cross w-1/6 max-w-20" style={{ "--i": index } as CSSProperties}>
              <Athlete id={id} pose="cheer" face="joy" on="piste" view="raised" className="w-full" />
            </li>
          ))}
        </ul>
      </div>
      <Button size="lg" className="mt-5 w-full tablet:w-auto" onClick={() => setOpen(false)}>
        {t.action}
      </Button>
    </Dialog>
  );
};
