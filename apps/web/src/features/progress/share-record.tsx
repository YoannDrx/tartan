"use client";

import { m } from "@tartan/i18n";
import { Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

// Partager un record : l'image est préparée par le serveur, puis remise au menu de partage du téléphone. Sans
// menu de partage (la plupart des ordinateurs), elle est enregistrée, à partager ensuite.
export const ShareRecord = ({ href, discipline }: { href: string; discipline: string }) => {
  const [pending, setPending] = useState(false);
  const share = async () => {
    setPending(true);
    try {
      const response = await fetch(href);
      if (!response.ok) throw new Error("record_card");
      const file = new File([await response.blob()], m.recordCard.filename(discipline), { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: m.recordCard.shareTitle(discipline) }).catch((error: unknown) => {
          // Fermer le menu de partage n'est pas une erreur.
          if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
        });
      } else {
        const url = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        URL.revokeObjectURL(url);
        toast.ok(m.recordCard.downloaded);
      }
    } catch {
      toast.error(m.recordCard.failed);
    } finally {
      setPending(false);
    }
  };
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={share}
      aria-label={m.recordCard.shareLabel(discipline)}
    >
      <Share2 aria-hidden className="size-4" />
      {m.recordCard.share}
    </Button>
  );
};
