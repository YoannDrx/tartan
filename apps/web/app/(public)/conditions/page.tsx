import type { Metadata } from "next";
import { LegalPage } from "@/features/shell/legal-page";

export const metadata: Metadata = { title: "Conditions d'utilisation" };

export default function ConditionsPage() {
  return (
    <LegalPage title="Conditions d'utilisation" updated="1er novembre 2026">
      <p>Éditeur : Yodev, Yoann Andrieux, entrepreneur individuel, SIREN 803 272 590, 7 allée des Jonquilles, 95130 Franconville.</p>
      <h2>Le service</h2>
      <p>
        Tartan aide un coach d'athlétisme et ses athlètes à planifier, suivre et analyser l'entraînement. Les offres payantes relèvent des conditions de vente.
      </p>
      <h2>Ce que Tartan n'est pas</h2>
      <p>
        Tartan n'est pas un dispositif médical. Les indicateurs sont des aides à la décision, pas des diagnostics. En
        cas de douleur, consulte un professionnel de santé.
      </p>
      <h2>Les contenus</h2>
      <p>
        Tu restes responsable de ce que tu publies. Tu dois avoir l'accord des personnes que tu filmes. Tout contenu
        peut être signalé depuis l'app, et tout utilisateur bloqué. Les signalements sont examinés sous 48 heures ouvrées ; un contenu illicite est retiré et son auteur peut être exclu.
      </p>
      <h2>Ton compte</h2>
      <p>
        Tu peux supprimer ton compte à tout moment depuis les réglages. Si tu es le seul coach de ton espace, l'espace
        et ses données sont supprimés avec lui ; sinon, il revient au coach suivant.
      </p>
      <h2>Droit applicable</h2>
      <p>Droit français.</p>
    </LegalPage>
  );
}
