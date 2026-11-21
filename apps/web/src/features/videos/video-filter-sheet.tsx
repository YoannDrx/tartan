"use client";

import { w } from "@tartan/i18n/web";
import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

// Sous 1024 px, les filtres attendent dans une feuille : la première vidéo reste dans le premier écran (audit G2).
// Le bouton dit combien de filtres sont actifs ; « Effacer » les retire d'un geste.
export function VideoFilterSheet({
  active,
  clearHref,
  children,
}: {
  active: number;
  clearHref: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 desktop:hidden">
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={w.video.filters.title}
        trigger={
          <Button variant="secondary" size="sm">
            <SlidersHorizontal aria-hidden className="size-4" />
            {w.video.filters.open}
            {active ? (
              <span className="t-num rounded-full bg-cta px-2 text-[13px] leading-5 text-on-cta">
                {w.video.filters.active(active)}
              </span>
            ) : null}
          </Button>
        }
      >
        {children}
      </Dialog>
      {active ? (
        <Link href={clearHref} className="flex min-h-11 items-center px-2 font-semibold underline underline-offset-4">
          {w.video.filters.clear}
        </Link>
      ) : null}
    </div>
  );
}
