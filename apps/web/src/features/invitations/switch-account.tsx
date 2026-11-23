"use client";

import { w } from "@tartan/i18n/web";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

// Connecté avec la mauvaise adresse : on se déconnecte ici, et l'invitation se rouvre pour l'autre compte.
export const SwitchAccountButton = ({ returnTo }: { returnTo: string }) => {
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void authClient
          .signOut()
          .catch(() => undefined)
          .finally(() => window.location.assign(returnTo));
      }}
    >
      {w.auth.switchAccount}
    </Button>
  );
};
