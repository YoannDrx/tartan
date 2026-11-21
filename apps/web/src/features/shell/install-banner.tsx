"use client";

import { m } from "@tartan/i18n";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { enablePush, pushSupported } from "./push";
import {
  hasInstallOpportunity,
  hostInstallOffer,
  INSTALL_OPPORTUNITY,
  installOfferHosted,
} from "./install-opportunity";

const DISMISSED = "tartan.install-dismissed";
const QUIET_MS = 14 * 24 * 60 * 60 * 1000;
const SUMMARY_SCREENS = ["/suivi", "/calendrier", "/aujourdhui"];

type InstallEvent = Event & { prompt: () => Promise<void> };
type Offer = "ios" | "android" | "push" | null;

const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

// Une tablette ou un ordinateur n'a pas besoin de cette invitation.
const isPhone = () =>
  window.matchMedia("(hover: none) and (pointer: coarse)").matches && Math.min(screen.width, screen.height) < 768;

const dismissedRecently = () => {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISSED) ?? 0) < QUIET_MS;
  } catch {
    return false;
  }
};

// Ce que ce téléphone peut recevoir : l'ajout à l'écran d'accueil (iPhone), l'installation (Android), ou les
// notifications quand l'app est déjà installée. Rien sur ordinateur, rien après un « Plus tard » récent.
const useInstallOffer = () => {
  const [offer, setOffer] = useState<Offer>(null);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (dismissedRecently() || !isPhone()) return;
    const canAskPush = () => pushSupported() && Notification.permission === "default" && Boolean(vapidKey);
    // Après le premier rendu : le serveur ne connaît ni le téléphone ni les permissions.
    const first = setTimeout(() => {
      if (isIos() && !standalone()) setOffer("ios");
      else if (canAskPush()) setOffer("push");
    }, 0);
    const onInstallable = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
      setOffer((current) => current ?? "android");
    };
    window.addEventListener("beforeinstallprompt", onInstallable);
    return () => {
      clearTimeout(first);
      window.removeEventListener("beforeinstallprompt", onInstallable);
    };
  }, [vapidKey]);

  const later = () => {
    try {
      localStorage.setItem(DISMISSED, String(Date.now()));
    } catch {
      // Stockage indisponible : la proposition reviendra à la prochaine ouverture.
    }
    setOffer(null);
  };
  return { offer, setOffer, installEvent, vapidKey, later };
};

const InstallOffer = ({
  variant,
  state: { offer, setOffer, installEvent, vapidKey, later },
}: {
  variant: "banner" | "row";
  state: ReturnType<typeof useInstallOffer>;
}) => {
  if (!offer) return null;
  const content = {
    ios: { title: m.install.iosTitle, body: m.install.iosSteps },
    android: { title: m.install.androidTitle, body: m.install.androidBody },
    push: { title: m.install.pushTitle, body: m.install.pushBody },
  }[offer];
  const Title = variant === "banner" ? "p" : "h3";
  return (
    <aside
      aria-label={content.title}
      className={variant === "banner" ? "on-card rounded-card bg-card p-4" : "flex flex-col"}
    >
      <Title className={cn(variant === "banner" ? "t-h2" : "font-semibold")}>{content.title}</Title>
      <p className={cn("mt-1", variant === "row" && "t-caption font-normal text-soft")}>{content.body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {offer === "android" && installEvent ? (
          <Button
            size="sm"
            onClick={async () => {
              await installEvent.prompt();
              setOffer(null);
            }}
          >
            {m.install.install}
          </Button>
        ) : null}
        {offer === "push" && vapidKey ? (
          <Button
            size="sm"
            onClick={async () => {
              const outcome = await enablePush(vapidKey).catch(() => "unavailable" as const);
              if (outcome === "on") toast.ok(m.install.pushOn);
              else if (outcome === "denied") toast.error(m.settings.pushDenied);
              else toast.error(m.common.genericError);
              setOffer(null);
            }}
          >
            {m.install.pushEnable}
          </Button>
        ) : null}
        <Button size="sm" variant="quiet" onClick={later}>
          {m.install.later}
        </Button>
      </div>
    </aside>
  );
};

// Dans une carte qui regroupe ce qui rend l'app plus pratique : la même proposition, posée en ligne. Tant qu'elle est
// là, le bandeau du bas s'efface. `onAvailable` dit à la carte s'il y a quelque chose à proposer sur ce téléphone.
export const InstallOfferRow = ({ onAvailable }: { onAvailable?: (available: boolean) => void }) => {
  const state = useInstallOffer();
  useEffect(() => hostInstallOffer(), []);
  useEffect(() => onAvailable?.(state.offer !== null), [state.offer, onAvailable]);
  return <InstallOffer variant="row" state={state} />;
};

// Après une première action utile, sur un écran de synthèse ; jamais pendant la construction d’une séance.
export const InstallBanner = () => {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [hosted, setHosted] = useState(false);
  const state = useInstallOffer();

  useEffect(() => {
    const refresh = () => {
      setReady(hasInstallOpportunity());
      setHosted(installOfferHosted());
    };
    const first = setTimeout(refresh, 0);
    window.addEventListener(INSTALL_OPPORTUNITY, refresh);
    return () => {
      clearTimeout(first);
      window.removeEventListener(INSTALL_OPPORTUNITY, refresh);
    };
  }, []);

  if (!ready || hosted || !SUMMARY_SCREENS.includes(pathname)) return null;
  return <InstallOffer variant="banner" state={state} />;
};
