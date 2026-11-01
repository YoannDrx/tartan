"use client";

import { m } from "@tartan/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "@/components/ui/toast";
import {
  processUploads,
  setUploadOwner,
  UPLOAD_EVENT,
  uploadProgress,
  type UploadProgress,
} from "@/features/videos/upload-queue";
import { flushOps, isSessionExpired, pendingOps, QUEUE_EVENT, setQueueOwner } from "./op-queue";
import { syncOfflinePages } from "./service-worker";

const RETRY_MS = 30_000;

const SpaceContext = createContext<{ organizationId: string } | null>(null);

export const useSpaceId = (): string => {
  const value = useContext(SpaceContext);
  if (!value) throw new Error("useSpaceId hors de OfflineProvider");
  return value.organizationId;
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
  const [pending, setPending] = useState(0);
  const [expired, setExpired] = useState(false);
  const [upload, setUpload] = useState<UploadProgress>({ waiting: 0, pct: null });

  // Le propriétaire doit être connu avant tout envoi lancé par un écran enfant.
  setQueueOwner(userId);
  setUploadOwner(userId);

  useEffect(() => {
    const refreshCounts = async () => {
      setPending((await pendingOps()).length);
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
    void flush();
    void syncOfflinePages(organizationId);
    const visible = () => {
      if (document.visibilityState === "visible") void flush();
    };
    const timer = setInterval(() => void flush(), RETRY_MS);
    window.addEventListener("online", flush);
    window.addEventListener("offline", flush);
    window.addEventListener(QUEUE_EVENT, refreshCounts);
    window.addEventListener(UPLOAD_EVENT, refreshCounts);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", flush);
      window.removeEventListener("offline", flush);
      window.removeEventListener(QUEUE_EVENT, refreshCounts);
      window.removeEventListener(UPLOAD_EVENT, refreshCounts);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [organizationId, router]);

  const lines = [
    !online ? m.offline.bar : null,
    pending > 0 ? m.offline.pending(pending) : null,
    upload.pct !== null
      ? m.offline.uploading(upload.pct)
      : upload.waiting > 0
        ? m.offline.uploadWaiting(upload.waiting)
        : null,
  ].filter(Boolean);

  return (
    <SpaceContext.Provider value={{ organizationId }}>
      {lines.length > 0 || expired ? (
        <div
          role="status"
          className="on-card sticky top-0 z-40 flex flex-wrap items-center gap-x-3 bg-card px-4 py-1.5"
        >
          <span className="t-caption font-semibold">{lines.join(", ")}</span>
          {expired ? (
            <Link href="/connexion" className="t-caption inline-flex min-h-11 items-center font-semibold">
              {m.offline.session} {m.offline.signIn}
            </Link>
          ) : null}
        </div>
      ) : null}
      {children}
    </SpaceContext.Provider>
  );
};
