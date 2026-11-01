import type { Metadata } from "next";
import { PLANS, TRIAL_DAYS, formatPrice } from "@tartan/domain";
import { LegalPage } from "@/features/shell/legal-page";

export const metadata: Metadata = { title: "Conditions de vente" };

const price = (plan: "coach" | "club") => {
  const prices = PLANS[plan].prices;
  return prices ? `${formatPrice(prices.month)} par mois ou ${formatPrice(prices.year)} par an` : "";
};

export default function CgvPage() {
  return (
    <LegalPage title="Conditions de vente" updated="1er novembre 2026">
      <h2>Vendeur</h2>
      <p>Yodev, Yoann Andrieux, entrepreneur individuel, SIREN 803 272 590, 7 allée des Jonquilles, 95130 Franconville. Contact : hello@tartan.coach.</p>
      <h2>Offres et prix</h2>
      <ul>
        <li>Découverte : gratuite, 1 groupe, 5 athlètes, 10 vidéos par mois conservées 30 jours.</li>
        <li>Coach : {price("coach")}, jusqu'à 30 athlètes, 2 coachs, 100 vidéos par mois conservées 1 an.</li>
        <li>Club : {price("club")}, coachs, athlètes et vidéos illimités.</li>
      </ul>
      <p>Prix en euros. TVA non applicable, article 293 B du Code général des impôts. L'abonnement est payé par le coach ou le club ; les athlètes ne paient jamais.</p>
      <h2>Essai et durée</h2>
      <p>
        Le premier abonnement d'un espace commence par {TRIAL_DAYS} jours d'essai. Sans résiliation avant la fin de l'essai, le premier paiement est prélevé à
        cette date. L'abonnement se renouvelle ensuite tacitement chaque mois ou chaque année, selon la formule choisie.
      </p>
      <h2>Paiement et factures</h2>
      <p>
        Sur le web, le paiement est traité par Stripe, et les factures sont disponibles dans la gestion de l'abonnement. Dans l'application mobile, l'achat passe par
        l'App Store ou Google Play, selon leurs propres conditions.
      </p>
      <h2>Résiliation</h2>
      <p>
        La résiliation se fait à tout moment depuis la page Abonnement, ou depuis les réglages du téléphone pour un achat intégré. Elle prend effet à la fin de la
        période payée ; l'espace repasse alors en offre Découverte. Les athlètes et les données existants sont conservés ; seul l'ajout au-delà des limites est
        bloqué, et les vidéos plus anciennes que la durée de conservation de l'offre sont retirées.
      </p>
      <h2>Impayé</h2>
      <p>En cas d'échec de paiement, l'accès est maintenu pendant les nouvelles tentatives de prélèvement. Sans régularisation, l'abonnement est résilié.</p>
      <h2>Droit de rétractation</h2>
      <p>
        Le client consommateur dispose de 14 jours à compter de la souscription pour se rétracter, sans motif, en écrivant à hello@tartan.coach. S'il demande à utiliser
        le service payant avant la fin de ce délai, le montant correspondant au service déjà fourni reste dû.
      </p>
      <h2>Parrainage</h2>
      <p>
        Un mois offert au parrain et au filleul, une fois le filleul abonné depuis 30 jours après son essai. Pas d'auto-parrainage, 12 récompenses par an au maximum. Les
        athlètes mineurs ne participent pas au parrainage.
      </p>
      <h2>Médiation et litiges</h2>
      <p>
        En cas de litige, écris d'abord à hello@tartan.coach. Le client consommateur peut recourir gratuitement à un médiateur de la consommation : [À DÉFINIR : médiateur
        désigné avant toute vente aux particuliers]. Droit français.
      </p>
    </LegalPage>
  );
}
