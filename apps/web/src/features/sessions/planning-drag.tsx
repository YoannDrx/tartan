"use client";

import type { CalendarSession, SessionType } from "@tartan/contracts";
import { motion } from "@tartan/design-tokens";
import { addDays } from "@tartan/domain";
import { capitalize, formatDateLong, m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Ban, MoveRight } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import {
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type DragEvent as ReactDragEvent,
} from "react";
import { ActivityPicto } from "@/components/pictos";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { activityColors } from "@/lib/activity-colors";
import { cn } from "@/lib/cn";
import { usePointerDrag, type DragBox, type PointerDrag } from "@/lib/use-pointer-drag";
import { landingIndex, moveInPlanning } from "./planning-order";
import { duplicateSessionAction, moveSessionAction } from "./session.action";

const t = w.planning;

/** Ce qu'il faut d'une séance pour la saisir, l'annoncer et la montrer en aperçu. */
export type PlanItem = { id: string; title: string; type: SessionType; date: string; locked?: boolean };
/** `open` : la séance peut s'y poser ; `same` : c'est déjà son jour ; `locked` : ce membre n'a pas le droit. */
export type DayDrop = { day: string; state: "open" | "same" | "locked" };
export type Planning = ReturnType<typeof usePlanning>;

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
// La même carte existe parfois deux fois (grille du téléphone et de l'ordinateur) : seule compte celle affichée.
const shown = (selector: string) =>
  [...document.querySelectorAll<HTMLElement>(selector)].find((element) => element.offsetParent !== null) ?? null;
const cardOf = (id: string) => shown(`[data-plan-card="${id}"]`);
const dayShown = (day: string) => shown(`[data-plan-day="${day}"]`) !== null;

// Où poser l'aperçu. Une carte de la semaine reste sous le pointeur, tenue là où elle a été saisie. Une ligne
// du mois se glisse vers des cases bien plus petites que l'aperçu : il se décale pour laisser voir la case
// visée, à côté du pointeur à la souris, au-dessus du doigt au toucher.
const ghostPlace = (drag: PointerDrag<PlanItem, DayDrop>) => {
  const width = Math.min(Math.max(drag.origin.width, 184), 296);
  if (drag.origin.height >= 64)
    return {
      left: drag.x - Math.min(drag.grab.x - drag.origin.left, width - 24),
      top: drag.y - (drag.grab.y - drag.origin.top),
      width,
      above: false,
    };
  const left = Math.min(Math.max(drag.touch ? drag.x - width / 2 : drag.x + 14, 8), window.innerWidth - width - 8);
  return drag.touch ? { left, top: drag.y - 28, width, above: true } : { left, top: drag.y + 14, width, above: false };
};

/**
 * Le déplacement des séances dans le planning, pour les vues Semaine et Mois : glisser au pointeur ou au doigt,
 * date changée tout de suite, retour à la place d'origine si le serveur refuse, et « Déplacer » ou
 * « Dupliquer » par le choix d'une date, sans glisser.
 */
export function usePlanning(source: CalendarSession[], readOnly: string[] = []) {
  const router = useRouter();
  // La date change à l'écran dès le dépôt ; la liste du serveur la remplace à la réponse, ou la rétablit.
  const [sessions, applyMove] = useOptimistic(source, (current, moved: { id: string; date: string }) =>
    moveInPlanning(current, moved.id, moved.date),
  );
  const [, startMove] = useTransition();
  const [announce, setAnnounce] = useState("");
  // Le dernier jour où une séance s'est posée : la grille du téléphone ouvre ce jour-là.
  const [landed, setLanded] = useState<{ id: string; day: string } | null>(null);
  const [target, setTarget] = useState<{ mode: "move" | "duplicate"; item: PlanItem } | null>(null);
  const [date, setDate] = useState("");
  const locked = useMemo(() => new Set(readOnly), [readOnly]);
  // D'où la carte part pour se poser, et quelle carte reprend le focus après un déplacement au clavier.
  const landing = useRef<{ id: string; day: string; from: DragBox } | null>(null);
  const refocus = useRef<string | null>(null);

  useLayoutEffect(() => {
    const pending = landing.current;
    if (!pending) return;
    const card = cardOf(pending.id);
    // Tant que la carte n'est pas rendue à son nouveau jour, il n'y a rien à poser.
    if (!card || card.dataset.planDate !== pending.day) return;
    landing.current = null;
    // Mouvement réduit : la carte est déjà à sa place, sans trajet.
    if (reducedMotion()) return;
    const to = card.getBoundingClientRect();
    const dx = pending.from.left - to.left;
    const dy = pending.from.top - to.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    card.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], {
      duration: motion.duration.enter,
      easing: motion.easing.reception,
    });
  });

  const move = (item: PlanItem, day: string, from?: DragBox | null) => {
    if (day === item.date || item.locked) return;
    const visible = dayShown(day);
    landing.current = from && visible ? { id: item.id, day, from } : null;
    setLanded({ id: item.id, day });
    startMove(async () => {
      applyMove({ id: item.id, date: day });
      let failure: string | null = null;
      try {
        const result = await moveSessionAction({ id: item.id, date: day });
        if (result?.serverError !== undefined || result?.validationErrors) failure = result.serverError ?? "";
      } catch {
        failure = "";
      }
      const moved = t.moved(item.title, formatDateLong(day));
      if (failure === null) {
        // Hors de la période affichée, la carte quitte l'écran : le message dit où elle est partie.
        if (visible) setAnnounce(moved);
        else toast.ok(moved);
        return;
      }
      // Refus du serveur : la carte repart de là où elle s'était posée, vers sa place d'origine.
      const card = cardOf(item.id);
      landing.current =
        card && dayShown(item.date) ? { id: item.id, day: item.date, from: card.getBoundingClientRect() } : null;
      setLanded({ id: item.id, day: item.date });
      const back = t.moveFailed(item.title, formatDateLong(item.date));
      toast.error(failure && failure !== m.common.genericError ? `${back} ${failure}` : back);
    });
  };

  const { drag, handle } = usePointerDrag<PlanItem, DayDrop>({
    activation: "deliberate",
    locate: ({ x, y }, item) => {
      const day = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-plan-day]")?.dataset.planDay;
      if (!day) return null;
      return { day, state: item.locked ? "locked" : day === item.date ? "same" : "open" };
    },
    onStart: (item) => setAnnounce(item.locked ? t.forbidden : t.grabbed(item.title)),
    onEnd: (item, drop) => {
      // La carte se pose depuis l'endroit où l'aperçu a été lâché.
      if (drop?.state === "open")
        move(item, drop.day, document.querySelector("[data-plan-ghost]")?.getBoundingClientRect());
      else setAnnounce(item.locked ? t.forbidden : t.cancelled(item.title));
    },
    onCancel: (item) => setAnnounce(t.cancelled(item.title)),
  });

  const duplicate = useAction(duplicateSessionAction, {
    onSuccess: () => {
      toast.ok(m.calendar.duplicated);
      setTarget(null);
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });

  const item = (session: { id: string; title: string; type: SessionType; date: string }): PlanItem => ({
    id: session.id,
    title: session.title,
    type: session.type,
    date: session.date,
    locked: locked.has(session.id),
  });

  return {
    /** Les séances, la séance déplacée déjà à sa nouvelle date. */
    sessions,
    drag,
    announce,
    landed,
    item,
    /** À poser sur la carte : elle se saisit en entier, et son lien comme ses boutons restent utilisables. */
    card: (planItem: PlanItem) => ({
      ...handle(planItem),
      "data-plan-card": planItem.id,
      "data-plan-date": planItem.date,
      "data-plan-held": drag?.item.id === planItem.id ? "" : undefined,
      "data-drag-source": "",
      // Le glisser natif du navigateur (lien, image) ferait double emploi.
      onDragStart: (event: ReactDragEvent<HTMLElement>) => event.preventDefault(),
    }),
    /** La carte que l'on tient : elle s'atténue et laisse sa place en pointillés. */
    held: (id: string) => drag?.item.id === id,
    /** À poser sur chaque jour : c'est là que le pointeur lit sa destination. */
    day: (day: string) => ({
      "data-plan-day": day,
      "data-drop": drag?.drop?.day === day ? drag.drop.state : undefined,
    }),
    /** Ce que le jour survolé montre : où la séance peut se poser, ou qu'elle ne le peut pas. */
    dayState: (day: string): DayDrop["state"] | null => (drag?.drop?.day === day ? drag.drop.state : null),
    /** Le rang que prendra la séance dans le jour survolé, ou -1 ailleurs. */
    markerAt: (day: string) =>
      drag?.drop?.state === "open" && drag.drop.day === day ? landingIndex(sessions, drag.item.id, day) : -1,
    askMove: (planItem: PlanItem) => {
      setDate(planItem.date);
      setTarget({ mode: "move", item: planItem });
    },
    askDuplicate: (planItem: PlanItem) => {
      setDate(addDays(planItem.date, 7));
      setTarget({ mode: "duplicate", item: planItem });
    },
    dialog: {
      target,
      date,
      setDate,
      pending: duplicate.isPending,
      close: () => setTarget(null),
      submit: () => {
        if (!target) return;
        if (target.mode === "duplicate") return duplicate.execute({ id: target.item.id, date });
        refocus.current = target.item.id;
        setTarget(null);
        move(target.item, date);
      },
      // Le bouton qui a ouvert le dialogue a changé de jour avec sa carte : le focus la suit.
      restoreFocus: (event: Event) => {
        const id = refocus.current;
        refocus.current = null;
        const control = id ? cardOf(id)?.querySelector<HTMLElement>("[data-plan-focus]") : null;
        if (!control) return;
        event.preventDefault();
        control.focus();
      },
    },
  };
}

/** Les classes d'un jour survolé pendant un glisser : fond teinté et contour en pointillés. Ce sont des états. */
export const dayClass = (state: DayDrop["state"] | null) =>
  cn(
    state === "open" && "bg-raise outline-2 -outline-offset-2 outline-dashed outline-accent",
    state === "locked" && "outline-2 -outline-offset-2 outline-dashed outline-control-line",
  );

/** Le trait qui montre où la séance va se ranger dans la journée. Il ne prend aucune place. */
export const DropMarker = ({ show, className }: { show: boolean; className?: string }) =>
  show ? (
    <div aria-hidden className={cn("pointer-events-none relative h-0", className)}>
      <span data-plan-marker className="absolute inset-x-0 top-0 h-1 -translate-y-1/2 rounded-full bg-accent" />
    </div>
  ) : null;

/** Dit qu'un jour refuse la séance, par une icône et des mots : la couleur seule ne suffirait pas. */
export const ForbiddenNote = ({ compact }: { compact?: boolean }) => (
  <span data-plan-forbidden className="inline-flex items-center gap-1 t-caption text-soft" title={t.forbiddenDay}>
    <Ban aria-hidden className="size-3.5 shrink-0" />
    <span className={compact ? "sr-only" : undefined}>{t.forbiddenDay}</span>
  </span>
);

/** L'aperçu qui suit le pointeur, l'annonce aux lecteurs d'écran et le choix d'une date. Une fois par vue. */
export function PlanningLayer({ planning }: { planning: Planning }) {
  const { drag, dialog } = planning;
  const place = drag ? ghostPlace(drag) : null;
  const tint = drag ? activityColors(drag.item.type) : null;
  const drop = drag?.drop ?? null;
  return (
    <>
      {drag && place && tint ? (
        // Soulevé par un contour franc et une ombre douce : pas d'ombre lourde.
        <div
          aria-hidden
          data-plan-ghost
          className={cn(
            "on-card pointer-events-none fixed left-0 top-0 z-50 rounded-thumb border-2 bg-card-raised p-2 shadow-float",
            // Le contour d'action dit « ça se pose » : il s'éteint là où la séance ne peut pas aller.
            drop?.state === "locked" ? "border-control-line" : "border-accent",
          )}
          style={{
            width: place.width,
            transform: `translate(${place.left}px, ${place.top}px)${place.above ? " translateY(-100%)" : ""}`,
          }}
        >
          <p
            className="inline-flex max-w-full items-center gap-1.5 rounded px-1.5 py-0.5 t-caption"
            style={{ backgroundColor: tint.background, color: tint.text }}
          >
            <ActivityPicto kind={drag.item.type} className="size-4 shrink-0" />
            <span className="truncate">{m.sessionType[drag.item.type]}</span>
          </p>
          <p className="mt-0.5 line-clamp-2 break-words font-semibold leading-snug text-fg">{drag.item.title}</p>
          <p
            className={cn(
              "mt-1 flex items-center gap-1.5 t-caption",
              drop?.state === "open" ? "font-semibold text-fg" : "text-soft",
            )}
          >
            {drop?.state === "open" ? <MoveRight className="size-4 shrink-0" /> : null}
            {drop?.state === "locked" ? <Ban className="size-4 shrink-0" /> : null}
            <span className="min-w-0 break-words">
              {drop?.state === "open"
                ? capitalize(formatDateLong(drop.day))
                : drop?.state === "locked"
                  ? t.forbidden
                  : drop?.state === "same"
                    ? t.stays
                    : t.nowhere}
            </span>
          </p>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {planning.announce}
      </p>
      <Dialog
        open={dialog.target !== null}
        onOpenChange={(open) => !open && dialog.close()}
        onCloseAutoFocus={dialog.restoreFocus}
        title={dialog.target?.mode === "duplicate" ? m.calendar.duplicate : t.moveTitle}
        description={dialog.target?.item.title}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            dialog.submit();
          }}
        >
          <Field label={m.builder.date}>
            {(a) => (
              <DateInput {...a} required value={dialog.date} onChange={(event) => dialog.setDate(event.target.value)} />
            )}
          </Field>
          <Button type="submit" disabled={dialog.pending}>
            {dialog.target?.mode === "duplicate" ? m.calendar.duplicate : t.moveSubmit}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
