"use client";

import type { CalendarView } from "@tartan/contracts";
import { useAction } from "next-safe-action/hooks";
import { FilterPill } from "@/components/filter-pill";
import { saveCalendarViewAction } from "./session.action";

// Le lien change la vue tout de suite ; l'enregistrement du choix suit, sans bloquer la navigation.
export const CalendarViewPill = ({
  view,
  href,
  active,
  label,
  desktopOnly,
}: {
  view: CalendarView;
  href: string;
  active: boolean;
  label: string;
  desktopOnly?: boolean;
}) => {
  const save = useAction(saveCalendarViewAction);
  return (
    <FilterPill
      href={href}
      active={active}
      onClick={() => save.execute({ calendarView: view })}
      className={desktopOnly ? "max-desktop:hidden" : undefined}
    >
      {label}
    </FilterPill>
  );
};
