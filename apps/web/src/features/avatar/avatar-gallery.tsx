"use client";

import { AVATAR_ANIMAL_IDS, AVATAR_GROUP_IDS, type AvatarPreset } from "@tartan/contracts";
import { w } from "@tartan/i18n/web";
import { Check } from "lucide-react";
import { useState } from "react";
import { PresetArt, presetLabel } from "@/components/avatar-art";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

const t = w.profile.gallery;

const FAMILIES: { legend: string; presets: AvatarPreset[] }[] = [
  { legend: t.group, presets: AVATAR_GROUP_IDS.map((id) => `athlete:${id}` as const) },
  { legend: t.animals, presets: AVATAR_ANIMAL_IDS.map((id) => `animal:${id}` as const) },
];

// La galerie : deux familles de boutons radio, puis une seule action. Rien n'est enregistré avant elle.
export const AvatarGallery = ({
  open,
  onOpenChange,
  current,
  onChoose,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: AvatarPreset | null;
  onChoose: (preset: AvatarPreset) => void;
  saving: boolean;
}) => {
  // Remontée à chaque ouverture : la sélection repart de l'avatar actuel.
  const [picked, setPicked] = useState<AvatarPreset | null>(current);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !saving && onOpenChange(next)}
      title={t.title}
      description={t.detail}
      wide
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (picked) onChoose(picked);
        }}
      >
        {FAMILIES.map((family) => (
          <fieldset key={family.legend} className="flex flex-col gap-2">
            <legend className="t-section mb-2">{family.legend}</legend>
            <div className="grid grid-cols-4 gap-x-2 gap-y-3 tablet:grid-cols-6">
              {family.presets.map((preset) => {
                const label = presetLabel(preset);
                const checked = picked === preset;
                return (
                  <label
                    key={preset}
                    className="group relative flex min-h-11 cursor-pointer flex-col items-center gap-1.5 rounded-button p-1 text-center has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--ctx-focus) hover:bg-raise"
                  >
                    <input
                      type="radio"
                      name="avatar"
                      value={preset}
                      checked={checked}
                      onChange={() => setPicked(preset)}
                      className="sr-only"
                    />
                    <span
                      className={
                        checked
                          ? "relative block size-14 rounded-full ring-[3px] ring-accent ring-offset-2 ring-offset-card"
                          : "relative block size-14 rounded-full"
                      }
                    >
                      <span className="block size-full overflow-hidden rounded-full">
                        <PresetArt preset={preset} />
                      </span>
                      {checked ? (
                        <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-accent text-on-accent">
                          <Check aria-hidden className="size-3.5" strokeWidth={3} />
                        </span>
                      ) : null}
                    </span>
                    <span className="t-caption break-words font-normal leading-tight">{label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
        <div className="sticky bottom-0 -mx-4 -mb-4 border-t border-card-line bg-card px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 tablet:-mx-6 tablet:-mb-6 tablet:px-6 tablet:pb-6">
          <Button type="submit" size="sm" disabled={!picked || picked === current || saving}>
            {t.save}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
