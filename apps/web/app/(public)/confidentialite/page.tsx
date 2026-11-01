import type { Metadata } from "next";
import { LegalPage } from "@/features/shell/legal-page";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function ConfidentialitePage() {
  return (
    <LegalPage title="Politique de confidentialité" updated="1er novembre 2026">
      <p>
        Responsable du traitement : Yodev, Yoann Andrieux, entrepreneur individuel, SIREN 803 272 590, 7 allée des
        Jonquilles, 95130 Franconville. Contact : hello@tartan.coach.
      </p>
      <h2>Ce que Tartan traite, et pourquoi</h2>
      <ul>
        <li>Identité et compte (nom, e-mail, date de naissance, photo) : pour fournir le service.</li>
        <li>Entraînement (séances, validations, charges, records) : pour le suivi entre le coach et l'athlète.</li>
        <li>
          Santé (blessures, douleurs, effort ressenti) : uniquement avec ton consentement explicite et séparé, révocable
          à tout moment dans les réglages. Sans lui, l'app fonctionne et ces champs restent masqués.
        </li>
        <li>
          Vidéos de saut : uniquement avec ton consentement. Visibles par tes coachs et par toi, jamais publiques,
          jamais partagées au groupe par défaut.
        </li>
        <li>
          Données techniques (jetons de notification, journaux d'erreurs sans donnée de santé) : pour faire fonctionner
          et sécuriser le service.
        </li>
      </ul>
      <h2>Athlètes de moins de 15 ans</h2>
      <p>
        En dessous de 15 ans, l'accord d'un titulaire de l'autorité parentale est demandé, conjointement avec celui de
        l'enfant, pour les traitements fondés sur le consentement (santé, vidéos). L'accord d'un seul parent suffit ;
        l'autre peut s'y opposer en nous écrivant.
      </p>
      <h2>Où vont tes données</h2>
      <p>
        Hébergement dans l'Union européenne (base de données à Francfort). Sous-traitants : Vercel, Neon, Mux, Expo,
        Resend, Stripe et RevenueCat. Certains sont établis aux États-Unis : les transferts sont encadrés par leurs
        clauses contractuelles types.
      </p>
      <h2>Combien de temps</h2>
      <p>
        Tes données restent tant que ton compte est actif. Un athlète retiré d'un espace, ou qui le quitte, voit sa
        fiche et ses données d'entraînement de cet espace supprimées. Les vidéos suivent la durée de conservation de
        l'offre de l'espace. Les factures sont conservées 10 ans, comme la loi l'impose. Les journaux d'accès aux
        données sensibles sont conservés 1 an.
      </p>
      <h2>Tes droits</h2>
      <p>
        Accès, rectification, export, opposition, retrait du consentement, suppression. L'export de tes données se fait
        depuis les réglages. La suppression du compte se fait depuis les réglages de l'app : elle efface ton compte et
        tes contenus, sauf obligation légale de conservation. Tu peux aussi saisir la CNIL.
      </p>
    </LegalPage>
  );
}
