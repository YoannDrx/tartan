"use client";

import type { SimState } from "@tartan/game";
import { m } from "@tartan/i18n";
import Link from "next/link";
import { type ComponentType, useState } from "react";
import { Athlete } from "@/components/athlete";
import { Marked } from "@/components/marked";
import { Button } from "@/components/ui/button";
import type { EventUi } from "@/features/game/event-ui";
import { StartScene } from "@/features/shell/start-scene";

// L'échauffement : après la ligne d'arrivée, une affiche du saut en hauteur. Rien du jeu n'est chargé avant le clic ;
// le clic charge la simulation et le dessin, et le concours se joue ici même.
type Loaded = { Runner: ComponentType<{ ui: EventUi<SimState> }>; ui: EventUi<SimState> };
const t = m.landing.warmUp;

export const WarmUp = ({ titleClassName, bodyClassName }: { titleClassName: string; bodyClassName: string }) => {
  const [game, setGame] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const open = async () => {
    setLoading(true);
    const [runner, highJump] = await Promise.all([
      import("@/features/game/game-runner"),
      import("@/features/game/high-jump-ui"),
    ]);
    setGame({ Runner: runner.default as never, ui: highJump.highJumpUi as unknown as EventUi<SimState> });
  };
  return (
    <section aria-labelledby="echauffement" className="mx-auto max-w-[1200px] px-4 pt-16 desktop:px-6 desktop:pt-24">
      <h2 id="echauffement" className={titleClassName}>
        <Marked text={t.title} />
      </h2>
      <p className={`mt-4 ${bodyClassName}`}>{t.body}</p>
      <div className="mt-8">
        {game ? (
          <game.Runner ui={game.ui} />
        ) : (
          <div className="flex flex-col gap-6 tablet:flex-row tablet:items-end tablet:gap-10">
            <StartScene className="max-w-[16rem]">
              <Athlete id="highJump" pose="lineup" on="piste" view="standing" className="h-40 w-auto" />
            </StartScene>
            <div className="flex flex-col items-start gap-3">
              <Button type="button" onClick={open} disabled={loading} className="min-h-16 min-w-56 text-[20px]">
                {loading ? m.game.loading : t.play}
              </Button>
              <Link
                href="/jeu"
                className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
              >
                {t.all}
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
