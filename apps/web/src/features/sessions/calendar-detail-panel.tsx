"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import Link from "next/link";
import { withSessionReturn } from "@/lib/session-navigation";
import { useRouter } from "next/navigation";
import { m } from "@tartan/i18n";

// Le panneau appartient au calendrier : ses données restent présentes après une actualisation.
export const CalendarDetailPanel = ({
  children,
  sessionId,
  returnTo,
}: {
  children: ReactNode;
  sessionId?: string;
  returnTo: string;
}) => {
  const router = useRouter();
  const opener = useRef<HTMLElement | null>(null);
  const openedHere = useRef(!sessionId);
  useEffect(() => {
    if (!sessionId) openedHere.current = true;
  }, [sessionId]);
  return (
    <Dialog.Root
      open={Boolean(sessionId)}
      onOpenChange={(open) => {
        if (!open) {
          if (openedHere.current) router.back();
          else router.replace(returnTo, { scroll: false });
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30" />
        <Dialog.Content
          className="world-work on-card fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-card px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))] desktop:left-auto desktop:w-[min(720px,60vw)] desktop:border-l desktop:border-card-line desktop:px-6"
          onOpenAutoFocus={() => {
            const active = document.activeElement;
            const source = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]")).find(
              (link) => new URL(link.href).searchParams.get("seance") === sessionId && link.getClientRects().length > 0,
            );
            opener.current = source ?? (active instanceof HTMLElement ? active : null);
          }}
          onCloseAutoFocus={(event) => {
            if (opener.current?.isConnected) {
              event.preventDefault();
              // Next restaure aussi le focus après la navigation : laisser finir ce rendu.
              requestAnimationFrame(() => opener.current?.focus({ preventScroll: true }));
            }
          }}
          // L'appel peut être en cours de saisie : un clic sur le fond ne ferme pas le panneau.
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <Dialog.Title className="sr-only">{m.calendar.sessionDetail}</Dialog.Title>
          <Dialog.Description className="sr-only">{m.calendar.backToContext}</Dialog.Description>
          <div className="sticky top-0 z-10 mb-2 flex justify-end bg-card">
            <Dialog.Close
              aria-label={m.common.close}
              className="inline-flex size-11 items-center justify-center rounded-button hover:bg-raise"
            >
              <X aria-hidden className="size-5" />
            </Dialog.Close>
          </div>
          {sessionId ? (
            <Link
              className="mb-2 inline-flex min-h-11 items-center font-semibold"
              href={withSessionReturn(`/seances/${sessionId}/suivi`, returnTo)}
            >
              {m.calendar.openSessionPage}
            </Link>
          ) : null}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
