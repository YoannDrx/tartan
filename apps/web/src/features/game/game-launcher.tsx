"use client";

import type { SimState } from "@tartan/game";
import { m } from "@tartan/i18n";
import { useState } from "react";
import { Athlete } from "@/components/athlete";
import { Button } from "@/components/ui/button";
import { StartScene } from "@/features/shell/start-scene";
import type { EventUi } from "./event-ui";

// L'affiche du meeting : rien de la simulation ni du rendu n'est chargé avant le choix d'une épreuve.
const EVENTS = [
  { id: "hurdles", athlete: "hurdles", load: () => import("./hurdles-ui").then((module) => module.hurdlesUi) },
  { id: "longJump", athlete: "longJump", load: () => import("./long-jump-ui").then((module) => module.longJumpUi) },
  {
    id: "tripleJump",
    athlete: "tripleJump",
    load: () => import("./triple-jump-ui").then((module) => module.tripleJumpUi),
  },
  { id: "highJump", athlete: "highJump", load: () => import("./high-jump-ui").then((module) => module.highJumpUi) },
  { id: "poleVault", athlete: "poleVault", load: () => import("./pole-vault-ui").then((module) => module.poleVaultUi) },
] as const;

type Loaded = { Runner: React.ComponentType<{ ui: EventUi<SimState> }>; ui: EventUi<SimState> };

export const GameLauncher = () => {
  const [game, setGame] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const open = async (event: (typeof EVENTS)[number]) => {
    setLoading(event.id);
    const [runner, ui] = await Promise.all([import("./game-runner"), event.load()]);
    setGame({ Runner: runner.default as Loaded["Runner"], ui: ui as unknown as EventUi<SimState> });
    setLoading(null);
  };
  if (game) {
    return (
      <div className="flex flex-col gap-4">
        <game.Runner key={game.ui.id} ui={game.ui} />
        <div>
          <Button type="button" variant="secondary" onClick={() => setGame(null)}>
            {m.game.other}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <ul aria-label={m.game.chooseLabel} className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
      {EVENTS.map((event) => (
        <li key={event.id} className="flex items-end gap-4">
          <StartScene className="w-28 shrink-0">
            <Athlete id={event.athlete} pose="lineup" on="piste" view="standing" className="h-32 w-auto" />
          </StartScene>
          <Button
            type="button"
            onClick={() => open(event)}
            disabled={loading !== null}
            className="mb-2 min-h-16 flex-1 text-[18px]"
          >
            {loading === event.id ? m.game.loading : m.game.events[event.id].play}
          </Button>
        </li>
      ))}
    </ul>
  );
};
