"use client";

import { usePathname } from "next/navigation";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { screenHelpFor } from "./screen-help";

const t = m.help;

// L'aide s'ouvre par-dessus l'écran et les liens partent dans un autre onglet : un brouillon en cours n'est jamais perdu.
export const ScreenHelpDialog = ({
  open,
  onOpenChange,
  staff,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: boolean;
}) => {
  const help = screenHelpFor(usePathname(), staff);
  const newTab = <span className="sr-only"> {t.screen.newTab}</span>;
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t.screen.title}>
      <ul className="flex flex-col gap-2">
        {help.tips.map((tip) => (
          <li key={tip} className="ml-5 list-disc">
            {tip}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col gap-2 tablet:flex-row">
        <Button asChild>
          <a href={`/aide#${help.theme}`} target="_blank" rel="noopener">
            {t.screen.all}
            {newTab}
          </a>
        </Button>
        <Button asChild variant="secondary">
          <a href="/contact" target="_blank" rel="noopener">
            {t.write}
            {newTab}
          </a>
        </Button>
      </div>
    </Dialog>
  );
};
