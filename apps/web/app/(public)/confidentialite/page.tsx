import type { Metadata } from "next";
import { LegalPage } from "@/features/shell/legal-page";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function ConfidentialitePage() {
  return (
    <LegalPage title="Politique de confidentialité" updated="4 novembre 2026">
      <p>
        Responsable du traitement : Yodev, Yoann Andrieux, entrepreneur individuel, SIREN 803 272 590, 7 allée des
        Jonquilles, 95130 Franconville. Contact : hello@tartan.coach.
      </p>
      <p>
        Tartan est réservé aux personnes majeures, en France. La date de naissance déclarée sert à appliquer cette règle
        : ce n'est pas une vérification d'identité.
      </p>
      <h2>Ce que Tartan traite, et pourquoi</h2>
      <ul>
        <li>
          Identité et compte (nom, e-mail, date de naissance, photo) : pour fournir le service. Base : le contrat.
        </li>
        <li>
          Entraînement (séances, validations, charges, records) : pour le suivi entre le coach et l'athlète. Base : le
          contrat.
        </li>
        <li>
          Santé (blessures, douleurs, effort ressenti) : uniquement avec ton consentement explicite et séparé, révocable
          à tout moment dans les réglages, pour chaque espace. Sans lui, l'app fonctionne et ces champs restent masqués.
          Base : ton consentement explicite.
        </li>
        <li>
          Vidéos de saut : uniquement avec ton consentement. Visibles par tes coachs et par toi, jamais publiques,
          jamais partagées au groupe par défaut. Base : ton consentement.
        </li>
        <li>
          Données techniques (jetons de notification, journaux d'erreurs sans donnée de santé) : pour faire fonctionner
          et sécuriser le service. Base : notre intérêt légitime.
        </li>
        <li>
          Mesure d'audience (pages vues sans jeton ni identifiant, provenance, pays, appareil, navigateur) :
          statistiques agrégées pour améliorer le service, sans cookie tiers ni donnée de santé. Base : notre intérêt
          légitime.
        </li>
      </ul>
      <h2>Si ton coach a créé ta fiche</h2>
      <p>
        Un coach peut préparer ta fiche (nom, date de naissance, groupe) avant que tu aies un compte, pour te suivre et
        t'inviter. C'est lui qui t'en informe. Tu peux demander sa correction ou sa suppression à ton coach, ou en nous
        écrivant.
      </p>
      <h2>Si tu retires ton consentement</h2>
      <p>
        Santé : ton effort ressenti, tes douleurs et tes blessures de cet espace sont effacés aussitôt, après
        confirmation. Vidéos : elles sont masquées aussitôt, puis effacées au bout de 30 jours, sauf si tu redonnes ton
        accord entre-temps. Le retrait ne remet pas en cause ce qui a été fait avant lui, et les exports déjà réalisés
        restent chez leurs détenteurs.
      </p>
      <h2>Où vont tes données</h2>
      <p>
        La base de données et l'exécution du service sont à Francfort. Les vidéos sont stockées et diffusées par Mux,
        aux États-Unis. Sous-traitants : Vercel, Neon, Mux, Expo, Resend, Sentry (suivi des erreurs, sans contenu
        d'entraînement ni de santé), Stripe et GitHub (copie de sauvegarde chiffrée). Certains sont établis aux
        États-Unis : les transferts sont encadrés par leurs clauses contractuelles types.
      </p>
      <h2>Combien de temps</h2>
      <p>
        Tes données restent tant que ton compte est actif. Un athlète retiré d'un espace, ou qui le quitte, voit sa
        fiche et ses données d'entraînement de cet espace supprimées. Les vidéos suivent la durée de conservation de
        l'offre de l'espace.
      </p>
      <ul>
        <li>Compte inactif : supprimé après 24 mois sans connexion, avec un préavis de 30 jours.</li>
        <li>Fiche préparée par un coach, sans compte : supprimée après 12 mois sans activité.</li>
        <li>Coordonnées d'une invitation : effacées 30 jours après son expiration.</li>
        <li>Notifications : 90 jours.</li>
        <li>Journaux d'accès aux données sensibles et d'audit : 1 an.</li>
        <li>Signalement traité : 1 an.</li>
        <li>Événements d'abonnement : 13 mois. Factures : 10 ans, comme la loi l'impose.</li>
        <li>Copies de sauvegarde : 30 jours. Une donnée effacée peut y rester jusqu'à leur expiration.</li>
      </ul>
      <h2>Tes droits</h2>
      <p>
        Accès, rectification, export, opposition, retrait du consentement, suppression. L'export de tes données se fait
        depuis les réglages. La suppression du compte se fait depuis les réglages de l'app : elle efface ton compte et
        tes contenus, sauf obligation légale de conservation. Tu peux aussi saisir la CNIL.
      </p>
    </LegalPage>
  );
}
