"use client";
import { useEffect, useState } from "react";
import { ImageCropper, exportCrop } from "@/features/avatar/image-cropper";
import { w } from "@tartan/i18n/web";

// Le téléphone fournit l'image à cet éditeur local. Seul le client natif authentifié envoie la photo enregistrée.
type Bridge = { postMessage: (value: string) => void };
const send = (value: object) =>
  (window as Window & { ReactNativeWebView?: Bridge }).ReactNativeWebView?.postMessage(JSON.stringify(value));
export default function PortraitPage() {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    async function receive(event: Event) {
      const data = (event as MessageEvent).data;
      if (data === "retry-save") {
        setSaving(false);
        return;
      }
      if (typeof data !== "string" || data.length > 16_800_000 || !/^data:image\/(?:jpeg|png|webp);base64,/.test(data))
        return;
      try {
        const img = new Image();
        img.src = data;
        await img.decode();
        const frame = await createImageBitmap(img);
        if (live) setBitmap(frame);
        else frame.close();
      } catch {
        if (live) send({ kind: "error" });
      }
    }
    document.addEventListener("message", receive);
    window.addEventListener("message", receive);
    send({ kind: "ready" });
    return () => {
      live = false;
      document.removeEventListener("message", receive);
      window.removeEventListener("message", receive);
    };
  }, []);
  useEffect(() => () => bitmap?.close(), [bitmap]);
  return (
    <>
      <ImageCropper
        bitmap={bitmap}
        fit="cover"
        open={Boolean(bitmap)}
        saving={saving}
        onOpenChange={(open) => {
          if (!open) send({ kind: "cancel" });
        }}
        onSave={async (state, frame, source, background) => {
          setSaving(true);
          try {
            const file = await exportCrop(source, state, frame, "cover", background);
            if (!file) throw new Error();
            const reader = new FileReader();
            reader.onload = () => send({ kind: "save", image: reader.result });
            reader.onerror = () => {
              setSaving(false);
              setFailed(true);
            };
            reader.readAsDataURL(file);
          } catch {
            setSaving(false);
            setFailed(true);
          }
        }}
      />
      {failed && <p role="alert">{w.profile.errors.export}</p>}
    </>
  );
}
