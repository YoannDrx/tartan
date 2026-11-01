import type { Metadata } from "next";
import { LegalPage } from "@/features/shell/legal-page";

export const metadata: Metadata = {
  title: "Supprimer mon compte",
  description: "Comment supprimer ton compte Tartan et les données associées.",
};

// Adresse à déclarer sur Google Play : la suppression doit être possible sans installer l'application (§ 16.2).
export default function SuppressionComptePage() {
  return (
    <LegalPage title="Supprimer mon compte" updated="2 novembre 2026">
      <h2>Depuis Tartan</h2>
      <p>
        Dans l'application ou sur <a href="https://app.tartan.coach/reglages#compte">app.tartan.coach</a> : Réglages,
        Compte, puis « Supprimer mon compte ». La suppression est immédiate.
      </p>
      <h2>Sans accès à ton compte</h2>
      <p>
        Écris à <a href="mailto:hello@tartan.coach">hello@tartan.coach</a> depuis l'adresse de ton compte, avec pour
        objet « Suppression de compte ». Nous la traitons sous 30 jours au plus.
      </p>
      <h2>Ce qui est supprimé</h2>
      <p>
        Ton compte, ton profil, tes séances réalisées, tes tests, tes blessures, tes vidéos, tes commentaires et tes
        accords. Si tu es propriétaire d'un espace sans autre coach, l'espace et ses données sont supprimés, et son
        abonnement est résilié. S'il a d'autres coachs, l'espace est repris par le plus ancien d'entre eux.
      </p>
      <h2>Ce qui est conservé</h2>
      <p>
        Les factures, 10 ans, comme la loi l'impose. Les journaux techniques, 1 an au plus, sans contenu d'entraînement.
      </p>
    </LegalPage>
  );
}
