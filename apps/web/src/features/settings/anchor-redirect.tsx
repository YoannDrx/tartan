"use client";

import type { OrgRole } from "@tartan/contracts";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { settingsAnchorHref } from "./sections";

// Les réglages tenaient sur une seule page à ancres. Un lien reçu avant le découpage (`/reglages#invitations`)
// arrive sur le sommaire : on le mène à sa rubrique, sans ajouter d'étape à l'historique.
export const AnchorRedirect = ({ role }: { role: OrgRole }) => {
  const router = useRouter();
  useEffect(() => {
    const follow = () => {
      const href = settingsAnchorHref(window.location.hash, window.location.search, role);
      if (href) router.replace(href);
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [role, router]);
  return null;
};
