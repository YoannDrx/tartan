"use client";

import { m } from "@tartan/i18n";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { enablePush, pushSupported } from "./push";
import { hasInstallOpportunity, INSTALL_OPPORTUNITY } from "./install-opportunity";

const DISMISSED = "tartan.install-dismissed";
const QUIET_MS = 14 * 24 * 60 * 60 * 1000;
const SUMMARY_SCREENS = ["/suivi", "/calendrier", "/aujourdhui"];

type InstallEvent = Event & { prompt: () => Promise<void> };
type Banner = "ios" | "android" | "push" | null;

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

// Après une première action utile, sur un écran de synthèse ; jamais pendant la construction d’une séance.
export const InstallBanner = () => {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    const refresh = () => setReady(hasInstallOpportunity());
    const first = setTimeout(refresh, 0);
    window.addEventListener(INSTALL_OPPORTUNITY, refresh);
    return () => {
      clearTimeout(first);
      window.removeEventListener(INSTALL_OPPORTUNITY, refresh);
    };
  }, []);

  useEffect(() => {
    if (dismissedRecently() || !isPhone()) return;
    const canAskPush = () => pushSupported() && Notification.permission === "default" && Boolean(vapidKey);
    // Après le premier rendu : le serveur ne connaît ni le téléphone ni les permissions.
    const first = setTimeout(() => {
      if (isIos() && !standalone()) setBanner("ios");
      else if (canAskPush()) setBanner("push");
    }, 0);
    const onInstallable = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
      setBanner((current) => current ?? "android");
    };
    window.addEventListener("beforeinstallprompt", onInstallable);
    return () => {
      clearTimeout(first);
      window.removeEventListener("beforeinstallprompt", onInstallable);
    };
  }, [vapidKey]);

  if (!banner || !ready || !SUMMARY_SCREENS.includes(pathname)) return null;

  const later = () => {
    try {
      localStorage.setItem(DISMISSED, String(Date.now()));
    } catch {
      // Stockage indisponible : le bandeau reviendra à la prochaine ouverture.
    }
    setBanner(null);
  };

  const content = {
    ios: { title: m.install.iosTitle, body: m.install.iosSteps },
    android: { title: m.install.androidTitle, body: m.install.androidBody },
    push: { title: m.install.pushTitle, body: m.install.pushBody },
  }[banner];

  return (
    <aside aria-label={content.title} className="on-card rounded-card bg-card p-4">
      <p className="t-h2">{content.title}</p>
      <p className="mt-1">{content.body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {banner === "android" && installEvent ? (
          <Button
            size="sm"
            onClick={async () => {
              await installEvent.prompt();
              setBanner(null);
            }}
          >
            {m.install.install}
          </Button>
        ) : null}
        {banner === "push" && vapidKey ? (
          <Button
            size="sm"
            onClick={async () => {
              const outcome = await enablePush(vapidKey).catch(() => "unavailable" as const);
              if (outcome === "on") toast.ok(m.install.pushOn);
              else if (outcome === "denied") toast.error(m.settings.pushDenied);
              else toast.error(m.common.genericError);
              setBanner(null);
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
