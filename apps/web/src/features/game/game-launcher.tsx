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
  { id: "discus", athlete: "discus", load: () => import("./discus-ui").then((module) => module.discusUi) },
] as const;

type Loaded =
  | { kind: "single"; Runner: React.ComponentType<{ ui: EventUi<SimState>; ranked?: boolean }>; ui: EventUi<SimState> }
  | {
      kind: "combined";
      Combined: React.ComponentType<{ Runner: never; uis: EventUi<SimState>[] }>;
      Runner: never;
      uis: EventUi<SimState>[];
    };

export const GameLauncher = () => {
  const [game, setGame] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const open = async (event: (typeof EVENTS)[number]) => {
    setLoading(event.id);
    const [runner, ui] = await Promise.all([import("./game-runner"), event.load()]);
    setGame({ kind: "single", Runner: runner.default as never, ui: ui as unknown as EventUi<SimState> });
    setLoading(null);
  };
  // Le combiné charge les six épreuves d'un coup, au premier geste.
  const openCombined = async () => {
    setLoading("combined");
    const [runner, combined, ...uis] = await Promise.all([
      import("./game-runner"),
      import("./combined-runner"),
      ...EVENTS.map((event) => event.load()),
    ]);
    setGame({
      kind: "combined",
      Combined: combined.default as never,
      Runner: runner.default as never,
      uis: uis as unknown as EventUi<SimState>[],
    });
    setLoading(null);
  };
  if (game) {
    return (
      <div className="flex flex-col gap-4">
        {game.kind === "single" ? (
          <game.Runner key={game.ui.id} ui={game.ui} ranked />
        ) : (
          <game.Combined Runner={game.Runner} uis={game.uis} />
        )}
        <div>
          <Button type="button" variant="secondary" onClick={() => setGame(null)}>
            {m.game.other}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
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
      <Button
        type="button"
        variant="secondary"
        onClick={openCombined}
        disabled={loading !== null}
        className="min-h-16 self-start text-[18px]"
      >
        {loading === "combined" ? m.game.loading : m.game.combined.play}
      </Button>
    </div>
  );
};
