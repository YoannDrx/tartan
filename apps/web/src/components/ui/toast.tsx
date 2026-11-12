"use client";

import { m } from "@tartan/i18n";
import { Check, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { create } from "zustand";

type Toast = { id: number; message: string; tone: "ok" | "error" };

// Un plafond d'offre atteint n'est pas une impasse : le message mène aux offres.
const PLAN_LIMIT_MESSAGES: ReadonlySet<string> = new Set([
  m.billing.limitAthletes,
  m.billing.limitGroups,
  m.billing.limitCoaches,
  m.billing.limitVideos,
]);
const isPlanLimit = (message: string) => PLAN_LIMIT_MESSAGES.has(message);

const useToasts = create<{ items: Toast[]; push: (t: Omit<Toast, "id">) => void; drop: (id: number) => void }>(
  (set) => ({
    items: [],
    push: (t) => {
      const id = Date.now() + Math.random();
      set((s) => ({ items: [...s.items, { ...t, id }] }));
      // Un message qui porte une action reste le temps de la lire et de l'atteindre.
      setTimeout(
        () => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
        isPlanLimit(t.message) ? 12_000 : 4500,
      );
    },
    drop: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
  }),
);

export const toast = {
  ok: (message: string) => useToasts.getState().push({ message, tone: "ok" }),
  error: (message: string) => useToasts.getState().push({ message, tone: "error" }),
};

export const ToastHost = () => {
  const items = useToasts((s) => s.items);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-24 z-[60] flex flex-col items-center gap-2 desktop:bottom-6"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className="toast-enter pointer-events-auto flex max-w-md items-center gap-2 on-card rounded-card border border-control-line bg-card px-4 py-3 shadow-float"
        >
          {t.tone === "ok" ? (
            <Check aria-hidden className="size-5 shrink-0" />
          ) : (
            <TriangleAlert aria-hidden className="size-5 shrink-0" />
          )}
          <span>{t.message}</span>
          {isPlanLimit(t.message) ? (
            <Link
              href="/abonnement"
              className="flex min-h-11 shrink-0 items-center rounded-full px-3 font-semibold text-ctx-link underline underline-offset-4"
            >
              {m.billing.limitAction}
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
};
