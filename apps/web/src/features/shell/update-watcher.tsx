"use client";

import type { ReleaseView } from "@tartan/contracts";
import { latestRelease, m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BUILD_ID } from "@/lib/build-id";
import { activateWaitingWorker, checkForWorkerUpdate } from "@/features/offline/service-worker";
import { markReleaseSeenAction } from "@/features/notifications/notifications.action";

const CHECK_EVERY_MS = 15 * 60 * 1000;
// Un rechargement au milieu d'une séance perdrait le mode séance : la proposition attend la fin.
const isBusyPath = (pathname: string) => /^\/seance\/[^/]+\/(mode|series)|^\/videos\/|^\/mes-sauts\//.test(pathname);

export const UpdateWatcher = ({ unseen }: { unseen: ReleaseView | null }) => {
  const pathname = usePathname();
  const [outdated, setOutdated] = useState(false);
  const [notice, setNotice] = useState(unseen);
  const seen = useAction(markReleaseSeenAction);

  useEffect(() => {
    if (BUILD_ID === "dev") return;
    const check = async () => {
      const res = await fetch("/api/v1/version", { cache: "no-store" }).catch(() => null);
      if (!res?.ok) return;
      const { build, releaseId } = (await res.json()) as { build: string; releaseId: string | null };
      if (build === BUILD_ID) return;
      await checkForWorkerUpdate();
      // Un correctif sans notes s'installe sans déranger, au prochain chargement.
      if (releaseId && releaseId !== latestRelease("web")?.id) setOutdated(true);
    };
    void check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, []);

  if (isBusyPath(pathname)) return null;

  if (outdated) {
    return (
      <aside className="on-card flex flex-wrap items-center gap-3 rounded-card bg-card p-4" aria-live="polite">
        <p className="min-w-0 flex-1 font-semibold">{m.releases.newVersion}</p>
        <Button
          size="sm"
          onClick={async () => {
            await activateWaitingWorker();
            window.location.reload();
          }}
        >
          {m.releases.reload}
        </Button>
      </aside>
    );
  }

  if (!notice) return null;
  const dismiss = () => {
    seen.execute({ releaseId: notice.id });
    setNotice(null);
  };
  return (
    <aside className="on-card flex flex-col gap-2 rounded-card bg-card p-4" aria-label={m.releases.title}>
      <p className="font-semibold">{notice.title}</p>
      <ul className="flex list-disc flex-col gap-1 pl-5">
        {notice.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={dismiss}>
          {m.releases.dismiss}
        </Button>
        <Button asChild size="sm" variant="secondary">
          <Link href="/nouveautes">{m.releases.seeAll}</Link>
        </Button>
      </div>
    </aside>
  );
};
