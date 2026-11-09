"use client";

import { CloudOff } from "lucide-react";
import { m } from "@tartan/i18n";
import Link from "next/link";
import { refreshPushSubscription } from "@/features/shell/push";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "@/components/ui/toast";
import {
  processUploads,
  setUploadOwner,
  UPLOAD_EVENT,
  UPLOAD_SETTLED_EVENT,
  uploadProgress,
  type UploadProgress,
} from "@/features/videos/upload-queue";
import { flushOps, isSessionExpired, pendingOps, QUEUE_EVENT, reviewRequiredOps, setQueueOwner } from "./op-queue";
import { syncOfflinePages } from "./service-worker";

const RETRY_MS = 30_000;

// Une valeur simple, stable d'un rendu à l'autre : un contexte qui change pendant l'hydratation fait
// repartir la page en rendu client, et ce qui vient d'être saisi est perdu.
const SpaceContext = createContext<string | null>(null);

export const useSpaceId = (): string => {
  const organizationId = useContext(SpaceContext);
  if (!organizationId) throw new Error("useSpaceId hors de OfflineProvider");
  return organizationId;
};

// Actions et vidéos en attente repartent dès que possible, sans qu'il y ait rien à faire.
export const OfflineProvider = ({
  organizationId,
  userId,
  children,
}: {
  organizationId: string;
  userId: string;
  children: ReactNode;
}) => {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const container = useRef<HTMLDivElement>(null);
  const banner = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(0);
  const [blocked, setBlocked] = useState(0);
  const [expired, setExpired] = useState(false);
  const [upload, setUpload] = useState<UploadProgress>({ waiting: 0, pct: null });

  // Le propriétaire doit être connu avant tout envoi lancé par un écran enfant.
  setQueueOwner(userId);
  setUploadOwner(userId);

  useEffect(() => {
    const refreshCounts = async () => {
      const ops = await pendingOps();
      const review = reviewRequiredOps(ops).length;
      setPending(ops.length - review);
      setBlocked(review);
      setExpired(isSessionExpired());
      setUpload(uploadProgress());
    };
    const flush = async () => {
      setOnline(navigator.onLine);
      if (!navigator.onLine) {
        // Sans réseau, rien ne part : on compte juste ce qui attend.
        await processUploads();
        return refreshCounts();
      }
      const [ops, videos] = await Promise.all([flushOps(), processUploads()]);
      await refreshCounts();
      if (ops.rejected > 0) toast.error(m.offline.rejected);
      for (const message of videos.refused) toast.error(message);
      if (ops.sent > 0 || videos.finished > 0) router.refresh();
    };
    const settled = (event: Event) => {
      const { refused, finished } = (event as CustomEvent<{ refused: string[]; finished: number }>).detail;
      for (const message of refused) toast.error(message);
      if (finished > 0) router.refresh();
    };
    void flush();
    void syncOfflinePages(organizationId);
    void refreshPushSubscription().catch(() => undefined);
    const visible = () => {
      if (document.visibilityState === "visible") void flush();
    };
    const timer = setInterval(() => void flush(), RETRY_MS);
    window.addEventListener("online", flush);
    window.addEventListener("offline", flush);
    window.addEventListener(QUEUE_EVENT, refreshCounts);
    window.addEventListener(UPLOAD_EVENT, refreshCounts);
    window.addEventListener(UPLOAD_SETTLED_EVENT, settled);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", flush);
      window.removeEventListener("offline", flush);
      window.removeEventListener(QUEUE_EVENT, refreshCounts);
      window.removeEventListener(UPLOAD_EVENT, refreshCounts);
      window.removeEventListener(UPLOAD_SETTLED_EVENT, settled);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [organizationId, userId, router]);

  const lines = [
    !online ? m.offline.bar : null,
    pending > 0 ? m.offline.pending(pending) : null,
    blocked > 0 ? m.offline.reviewPending(blocked) : null,
    upload.pct !== null
      ? m.offline.uploading(upload.pct)
      : upload.waiting > 0
        ? m.offline.uploadWaiting(upload.waiting)
        : null,
  ].filter(Boolean);

  const hasBanner = lines.length > 0 || expired;
  useEffect(() => {
    const root = container.current;
    const bar = banner.current;
    if (!root || !bar) return;
    const measure = () => root.style.setProperty("--offline-bar-height", `${bar.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--offline-bar-height");
    };
  }, [hasBanner]);

  return (
    <SpaceContext.Provider value={organizationId}>
      <div ref={container}>
        {hasBanner ? (
          <div
            ref={banner}
            role="status"
            className="offline-bar sticky top-0 z-40 flex min-h-11 flex-wrap items-center gap-x-3 bg-st-partial px-4 text-on-status"
          >
            <CloudOff aria-hidden className="size-4 shrink-0" />
            <span className="t-caption min-w-0 flex-1 py-2 font-semibold">{lines.join(", ")}</span>
            {blocked > 0 ? (
              <Link
                href="/synchronisation"
                className="t-caption inline-flex min-h-11 items-center font-semibold text-inherit"
              >
                {m.syncReview.open}
              </Link>
            ) : null}
            {expired ? (
              <Link
                href="/connexion"
                className="t-caption inline-flex min-h-11 items-center font-semibold text-inherit"
              >
                {m.offline.session} {m.offline.signIn}
              </Link>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </SpaceContext.Provider>
  );
};
