"use client";

import { knownAvatarPreset } from "@tartan/domain";
import { w } from "@tartan/i18n/web";
import { Camera, Images } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { presetLabel } from "@/components/avatar-art";
import { Avatar, type AvatarPerson } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { setAvatarPresetAction, uploadAvatarAction, uploadLogoAction } from "@/features/settings/settings.action";
import { onErr } from "@/features/settings/shared";
import { AvatarGallery } from "./avatar-gallery";
import { exportCrop, ImageCropper, openImage } from "./image-cropper";
import type { CropFit, CropState } from "./crop-geometry";

const t = w.profile;
// Le fichier d'origine reste dans le navigateur : seul le carré recadré part au serveur.
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif";

// Choisir un fichier, l'ouvrir, le recadrer, puis l'envoyer : la mécanique commune à la photo et au logo.
const useCropUpload = (fit: CropFit) => {
  const input = useRef<HTMLInputElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [open, setOpen] = useState(false);
  // Chaque image ouverte repart d'un recadrage neuf.
  const [version, setVersion] = useState(0);
  const pick = async (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error(t.errors.type);
    if (file.size > MAX_SOURCE_BYTES) return toast.error(t.errors.tooHeavy);
    try {
      setBitmap(await openImage(file));
      setVersion((v) => v + 1);
      setOpen(true);
    } catch {
      toast.error(t.errors.unreadable);
    }
  };
  const save = async (state: CropState, frame: number, send: (file: File) => void) => {
    if (!bitmap) return;
    const file = await exportCrop(bitmap, state, frame, fit).catch(() => null);
    if (!file) return toast.error(t.errors.export);
    send(file);
  };
  const close = () => {
    setOpen(false);
    bitmap?.close();
    setBitmap(null);
  };
  const fileInput = (label: string) => (
    <input
      ref={input}
      type="file"
      accept={ACCEPT}
      aria-label={label}
      tabIndex={-1}
      className="sr-only"
      onChange={(e) => void pick(e.target.files?.[0])}
    />
  );
  return {
    input,
    bitmap,
    open,
    version,
    setOpen: (next: boolean) => (next ? setOpen(true) : close()),
    save,
    close,
    fileInput,
  };
};

const Actions = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap gap-2">{children}</div>;

// La photo de profil : envoyer et recadrer une photo, choisir un avatar, ou revenir aux initiales.
export const AvatarEditor = ({ person, uploadEnabled }: { person: AvatarPerson; uploadEnabled: boolean }) => {
  const router = useRouter();
  const preset = knownAvatarPreset(person.avatarPreset);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const crop = useCropUpload("cover");
  const upload = useAction(uploadAvatarAction, {
    onSuccess: () => {
      toast.ok(t.avatar.photoSaved);
      crop.close();
      router.refresh();
    },
    onError: onErr,
  });
  const choose = useAction(setAvatarPresetAction, {
    onSuccess: ({ input }) => {
      toast.ok(input.preset ? t.avatar.presetSaved : t.avatar.initialsSaved);
      setGalleryOpen(false);
      router.refresh();
    },
    onError: onErr,
  });
  const current = person.avatarUrl
    ? t.avatar.currentPhoto
    : preset
      ? t.avatar.currentPreset(presetLabel(preset))
      : t.avatar.currentInitials;
  return (
    <section aria-labelledby="photo-de-profil" className="flex flex-col gap-3">
      <h3 id="photo-de-profil" className="t-caption text-inherit">
        {t.avatar.section}
      </h3>
      <div className="flex items-start gap-4">
        <Avatar person={person} size="xl" labelled />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="t-caption font-normal text-soft">
            <span className="sr-only">{current} </span>
            {t.avatar.detail}
          </p>
          <Actions>
            {uploadEnabled ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={upload.isPending}
                onClick={() => crop.input.current?.click()}
              >
                <Camera aria-hidden className="size-4" />
                {person.avatarUrl ? t.avatar.replace : t.avatar.upload}
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => setGalleryOpen(true)}>
              <Images aria-hidden className="size-4" />
              {t.avatar.choose}
            </Button>
            {person.avatarUrl || preset ? (
              <Button
                size="sm"
                variant="quiet"
                disabled={choose.isPending}
                onClick={() => choose.execute({ preset: null })}
              >
                {t.avatar.initials}
              </Button>
            ) : null}
          </Actions>
          {uploadEnabled ? null : <p className="t-caption font-normal text-soft">{t.avatar.uploadUnavailable}</p>}
        </div>
      </div>
      {uploadEnabled ? crop.fileInput(t.avatar.upload) : null}
      <ImageCropper
        key={crop.version}
        bitmap={crop.bitmap}
        fit="cover"
        open={crop.open}
        onOpenChange={crop.setOpen}
        onSave={(state, frame) => void crop.save(state, frame, (file) => upload.execute({ file }))}
        saving={upload.isPending}
      />
      <AvatarGallery
        key={galleryOpen ? "open" : "closed"}
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        current={person.avatarUrl ? null : preset}
        saving={choose.isPending}
        onChoose={(next) => choose.execute({ preset: next })}
      />
    </section>
  );
};

// Le logo de l'espace : le même recadrage, dans un carré, où le logo peut rester plus petit que le cadre.
export const LogoEditor = ({ logoUrl, name, alt }: { logoUrl: string | null; name: string; alt: string }) => {
  const router = useRouter();
  const crop = useCropUpload("contain");
  const upload = useAction(uploadLogoAction, {
    onSuccess: () => {
      toast.ok(t.logo.saved);
      crop.close();
      router.refresh();
    },
    onError: onErr,
  });
  return (
    <div className="flex items-center gap-4">
      <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-thumb bg-card-raised font-semibold">
        {logoUrl ? (
          <Image src={logoUrl} alt={alt} fill sizes="64px" className="object-contain" unoptimized />
        ) : (
          <Avatar person={{ name }} size="lg" className="rounded-thumb" />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {logoUrl ? null : <p className="t-caption font-normal text-soft">{t.logo.none}</p>}
        <Actions>
          <Button size="sm" variant="secondary" disabled={upload.isPending} onClick={() => crop.input.current?.click()}>
            <Camera aria-hidden className="size-4" />
            {logoUrl ? t.logo.replace : t.logo.upload}
          </Button>
        </Actions>
      </div>
      {crop.fileInput(t.logo.upload)}
      <ImageCropper
        key={crop.version}
        bitmap={crop.bitmap}
        fit="contain"
        open={crop.open}
        onOpenChange={crop.setOpen}
        onSave={(state, frame) => void crop.save(state, frame, (file) => upload.execute({ file }))}
        saving={upload.isPending}
      />
    </div>
  );
};
