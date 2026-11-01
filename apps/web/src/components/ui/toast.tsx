"use client";

import { Check, TriangleAlert } from "lucide-react";
import { create } from "zustand";

type Toast = { id: number; message: string; tone: "ok" | "error" };

const useToasts = create<{ items: Toast[]; push: (t: Omit<Toast, "id">) => void; drop: (id: number) => void }>(
  (set) => ({
    items: [],
    push: (t) => {
      const id = Date.now() + Math.random();
      set((s) => ({ items: [...s.items, { ...t, id }] }));
      setTimeout(() => set((s) => ({ items: s.items.filter((x) => x.id !== id) })), 4500);
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
          className="pointer-events-auto flex max-w-md items-center gap-2 rounded-card bg-ink px-4 py-3 text-white shadow-[0_8px_24px_rgba(21,22,26,0.16)]"
        >
          {t.tone === "ok" ? (
            <Check aria-hidden className="size-5 shrink-0" />
          ) : (
            <TriangleAlert aria-hidden className="size-5 shrink-0" />
          )}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
};
