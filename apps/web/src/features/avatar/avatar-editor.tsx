"use client";

import { knownAvatarPreset } from "@tartan/domain";
import { w } from "@tartan/i18n/web";
import { Camera, Images, Plus, Trash, Users } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { presetLabel } from "@/components/avatar-art";
import { Avatar, type AvatarPerson } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { setAvatarPresetAction, uploadAvatarAction, uploadLogoAction } from "@/features/settings/settings.action";
import { onErr } from "@/features/settings/shared";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/use-media-query";
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
  const save = async (
    state: CropState,
    frame: number,
    source: ImageBitmap,
    background: string | undefined,
    send: (file: File) => void,
  ) => {
    if (!bitmap) return;
    const file = await exportCrop(source, state, frame, fit, background).catch(() => null);
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
    pick,
    bitmap,
    open,
    version,
    setOpen: (next: boolean) => (next ? setOpen(true) : close()),
    save,
    close,
    fileInput,
  };
};

const itemClass =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-[8px] px-3 text-fg outline-none data-[highlighted]:bg-raise";

const Actions = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap gap-2">{children}</div>;

// Un bouton rond posé sur le bord du portrait, à 45° : son centre est sur le cercle, à 14,6 % du coin du carré.
// Un anneau de la couleur de la carte le détache de l'image, comme s'il y était incrusté.
const edgeButton =
  "absolute top-[85.355%] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-card transition-colors disabled:opacity-50";
// Le temps d'annuler une suppression : rien ne part au serveur avant.
const UNDO_MS = 5000;

// La photo de profil : un grand rond, et deux boutons sur son bord. Le « + » ajoute ou remplace (photo, appareil,
// avatar), la poubelle revient aux initiales après cinq secondes où l'on peut annuler. Toucher la photo la recadre.
export const AvatarEditor = ({ person, uploadEnabled }: { person: AvatarPerson; uploadEnabled: boolean }) => {
  const router = useRouter();
  const preset = knownAvatarPreset(person.avatarPreset);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const crop = useCropUpload("cover");
  const camera = useRef<HTMLInputElement>(null);
  // Prendre une photo n'a de sens que sur un appareil tactile, qui a un appareil photo à portée.
  const touch = useMediaQuery("(pointer: coarse)");
  // `removing` : la personne a demandé la suppression, l'aperçu montre déjà les initiales.
  // `pending` : les cinq secondes courent, « Annuler » est proposé.
  const [removing, setRemoving] = useState<"photo" | "preset" | null>(null);
  const [pending, setPending] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const addButton = useRef<HTMLButtonElement>(null);
  const removeButton = useRef<HTMLButtonElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
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
    onError: (failure) => {
      setRemoving(null);
      onErr(failure);
    },
  });
  // Les nouvelles données du serveur remplacent l'aperçu provisoire.
  const [seen, setSeen] = useState({ url: person.avatarUrl, preset: person.avatarPreset });
  if (seen.url !== person.avatarUrl || seen.preset !== person.avatarPreset) {
    setSeen({ url: person.avatarUrl, preset: person.avatarPreset });
    if (!pending) setRemoving(null);
  }
  // Quitter l'écran pendant les cinq secondes confirme la suppression : elle part tout de suite.
  useEffect(() => {
    const flush = () => {
      if (timer.current === undefined) return;
      window.clearTimeout(timer.current);
      timer.current = undefined;
      void setAvatarPresetAction({ preset: null });
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);
  useEffect(() => {
    if (pending) undoButton.current?.focus();
  }, [pending]);

  const shown = removing ? { ...person, avatarUrl: null, avatarPreset: null } : person;
  const hasPhoto = Boolean(shown.avatarUrl);
  const hasPreset = !hasPhoto && Boolean(preset) && !removing;
  const busy = upload.isPending || choose.isPending;

  const remove = () => {
    const kind = hasPhoto ? "photo" : "preset";
    setRemoving(kind);
    setPending(true);
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      setPending(false);
      addButton.current?.focus();
      choose.execute({ preset: null });
    }, UNDO_MS);
  };
  const undo = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    setPending(false);
    setRemoving(null);
    toast.ok(t.avatar.restored);
    // Le bouton revient avec l'image : le focus l'y retrouve.
    requestAnimationFrame(() => removeButton.current?.focus());
  };
  const recrop = async () => {
    try {
      const response = await fetch(person.avatarUrl!);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      await crop.pick(new File([blob], "avatar", { type: blob.type }));
    } catch {
      toast.error(t.errors.unreadable);
    }
  };
  const current = hasPhoto
    ? t.avatar.currentPhoto
    : hasPreset && preset
      ? t.avatar.currentPreset(presetLabel(preset))
      : t.avatar.currentInitials;

  return (
    <section aria-labelledby="photo-de-profil" className="flex flex-col gap-3">
      <h3 id="photo-de-profil" className="t-caption text-inherit">
        {t.avatar.section}
      </h3>
      <div className="relative mx-auto w-full max-w-72 desktop:max-w-80" data-testid="avatar-portrait">
        <Avatar person={shown} size="portrait" labelled />
        {/* Posé sur l'image plutôt qu'autour : l'image garde son nom pour les lecteurs d'écran. */}
        {uploadEnabled && hasPhoto && !busy ? (
          <button
            type="button"
            aria-label={t.avatar.recrop}
            className="absolute inset-0 rounded-full transition-shadow hover:ring-4 hover:ring-card-line"
            onClick={() => void recrop()}
          />
        ) : null}
        {hasPhoto || hasPreset ? (
          <button
            ref={removeButton}
            type="button"
            data-testid="avatar-initials"
            aria-label={hasPhoto ? t.avatar.removePhoto : t.avatar.removePreset}
            title={hasPhoto ? t.avatar.removePhoto : t.avatar.removePreset}
            disabled={busy}
            onClick={remove}
            className={cn(edgeButton, "left-[14.645%] size-12 bg-card-raised text-fg hover:bg-card-line")}
          >
            <Trash aria-hidden className="size-5" />
          </button>
        ) : null}
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger
            ref={addButton}
            aria-label={t.avatar.change}
            title={t.avatar.change}
            data-testid="avatar-add"
            disabled={busy}
            className={cn(edgeButton, "left-[85.355%] size-14 bg-cta text-on-cta hover:bg-cta-hover")}
          >
            <Plus aria-hidden className="size-6" strokeWidth={2.5} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              collisionPadding={8}
              className="menu-enter on-card z-50 w-[248px] max-w-[calc(100vw-16px)] rounded-card border border-card-line bg-card p-1.5 shadow-float-strong"
            >
              {uploadEnabled ? (
                <DropdownMenu.Item className={itemClass} onSelect={() => crop.input.current?.click()}>
                  <Images aria-hidden className="size-4" />
                  {t.avatar.fromLibrary}
                </DropdownMenu.Item>
              ) : null}
              {uploadEnabled && touch ? (
                <DropdownMenu.Item className={itemClass} onSelect={() => camera.current?.click()}>
                  <Camera aria-hidden className="size-4" />
                  {t.avatar.fromCamera}
                </DropdownMenu.Item>
              ) : null}
              <DropdownMenu.Item className={itemClass} onSelect={() => setGalleryOpen(true)}>
                <Users aria-hidden className="size-4" />
                {t.avatar.choose}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      <div aria-live="polite" className="flex min-h-11 flex-col items-center justify-center gap-1 text-center">
        {pending ? (
          <p className="flex flex-wrap items-center justify-center gap-x-2">
            <span>{removing === "photo" ? t.avatar.photoRemoved : t.avatar.presetRemoved}</span>
            <Button ref={undoButton} size="sm" variant="quiet" className="underline underline-offset-4" onClick={undo}>
              {t.avatar.undo}
            </Button>
          </p>
        ) : (
          <p className="t-caption max-w-prose font-normal text-soft">
            <span className="sr-only">{current} </span>
            {uploadEnabled && hasPhoto ? `${t.avatar.recropHint} ` : null}
            {t.avatar.detail}
          </p>
        )}
      </div>
      {uploadEnabled ? null : (
        <p className="t-caption text-center font-normal text-soft">{t.avatar.uploadUnavailable}</p>
      )}
      {uploadEnabled ? crop.fileInput(t.avatar.upload) : null}
      {uploadEnabled ? (
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="user"
          aria-label={t.avatar.fromCamera}
          tabIndex={-1}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void crop.pick(file);
          }}
        />
      ) : null}
      <ImageCropper
        key={crop.version}
        bitmap={crop.bitmap}
        fit="cover"
        open={crop.open}
        onOpenChange={crop.setOpen}
        onSave={(state, frame, source, background) =>
          void crop.save(state, frame, source, background, (file) => upload.execute({ file }))
        }
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
        onSave={(state, frame, source, background) =>
          void crop.save(state, frame, source, background, (file) => upload.execute({ file }))
        }
        saving={upload.isPending}
      />
    </div>
  );
};
