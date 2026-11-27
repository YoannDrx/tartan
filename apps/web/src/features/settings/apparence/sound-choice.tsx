"use client";

import { m } from "@tartan/i18n";
import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { playFeedback, setSoundsEnabled, soundsEnabled } from "@/lib/feedback";

// Sons et vibrations, sur cet appareil : activés par défaut, coupés d'un geste, avec un essai.
export const SoundChoice = () => {
  const t = m.appearance.sounds;
  const [on, setOn] = useState(true);
  // Lecture après le rendu serveur, qui ne connaît pas le stockage du navigateur.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOn(soundsEnabled()), []);
  const choose = (next: boolean) => {
    setOn(next);
    setSoundsEnabled(next);
    if (next) playFeedback("toggle");
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{t.title}</legend>
      <p className="text-soft">{t.hint}</p>
      <div className="flex flex-wrap items-center gap-2">
        {([true, false] as const).map((option) => (
          <label
            key={String(option)}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-second-line px-4 font-semibold",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
              on === option ? "bg-cta text-on-cta" : "bg-second hover:bg-second-hover",
            )}
          >
            <input
              type="radio"
              name="sounds"
              className="sr-only"
              data-feedback="off"
              checked={on === option}
              onChange={() => choose(option)}
            />
            {option ? <Volume2 aria-hidden className="size-4" /> : <VolumeX aria-hidden className="size-4" />}
            {option ? t.on : t.off}
          </label>
        ))}
        <Button variant="quiet" size="sm" feedback="success" disabled={!on}>
          {t.test}
        </Button>
      </div>
    </fieldset>
  );
};
