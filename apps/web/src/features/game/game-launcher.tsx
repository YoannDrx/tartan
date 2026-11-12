"use client";

import { m } from "@tartan/i18n";
import { type ComponentType, useState } from "react";
import { Athlete } from "@/components/athlete";
import { StartScene } from "@/features/shell/start-scene";
import { Button } from "@/components/ui/button";

// L'affiche du jeu : rien de la simulation ni du rendu n'est chargé avant le premier geste.
export const GameLauncher = () => {
  const [Game, setGame] = useState<ComponentType | null>(null);
  const [loading, setLoading] = useState(false);
  const open = async () => {
    setLoading(true);
    const loaded = await import("./hurdles-game");
    setGame(() => loaded.default);
  };
  if (Game) return <Game />;
  return (
    <div className="flex flex-col gap-6 tablet:flex-row tablet:items-end tablet:gap-10">
      <StartScene className="max-w-xs">
        <Athlete id="hurdles" pose="lineup" on="piste" view="standing" className="h-48 w-auto" />
      </StartScene>
      <div className="flex flex-col items-start gap-3">
        <Button type="button" onClick={open} disabled={loading} className="min-h-16 min-w-56 text-[20px]">
          {loading ? m.game.loading : m.game.play}
        </Button>
      </div>
    </div>
  );
};
