# Plan : mettre la web app en état de vendre

Objectif : une web app et une PWA qu'un coach inconnu peut trouver, payer et utiliser sans aide. Le mobile natif suit sans retarder cette ouverture. L'avancement est dans [../ETAT.md](../ETAT.md).

## Étape 1 : finir la configuration

| N° | Action | Qui | Vérification |
| --- | --- | --- | --- |
| W1 | Passkey de secours sur un second appareil, depuis `/admin/configuration` | Fondateur | Compteur à 2 dans Configuration, connexion avec chacune |
| W2 | Créer dans Resend le webhook `https://app.tartan.coach/api/webhooks/resend` sur `email.bounced`, `email.complained`, `email.suppressed` | Fondateur | Livraison de test acceptée dans Resend |
| W3 | Poser `RESEND_WEBHOOK_SECRET` en production, puis redéployer | Fondateur | Ligne « Webhook Resend » à En place dans Configuration |
| W4 | Vérifier le domaine `mail.tartan.coach` dans Resend (SPF, DKIM, DMARC), puis régler `EMAIL_FROM` | Fondateur, agent pour les DNS si accès | E-mail reçu avec le bon expéditeur, non classé en indésirables |
| W5 | Remplacer la clé OpenAI, signer l'accord de traitement OpenAI | Fondateur | Planificateur toujours fonctionnel |
| W6 | Ajouter une carte Mux, puis lever le plafond vidéo dans Configuration | Fondateur | Le message « espace vidéo plein » ne peut plus survenir |
| W7 | Passer Neon en offre payante, protéger la branche de production | Fondateur | Restauration à 7 jours disponible |
| W8 | Sortir les sauvegardes de GitHub ([procédure](../exploitation/sauvegarde.md)) | Agent, après choix du stockage | Copie chiffrée restaurée depuis la nouvelle destination |
| W9 | Offre Sentry suffisante, activer la sonde de disponibilité et celle des notifications | Fondateur, agent | Panne simulée reçue par e-mail |
| W10 | Activer Skew Protection dans Vercel si l'offre l'inclut | Fondateur | Ancien onglet fonctionnel pendant un déploiement |

## Étape 2 : prouver les parcours

1. Écrire et faire passer les tests critiques T01 à T08 de [automatisation.md](../tests/automatisation.md).
2. Dérouler [recette-reelle.md](../tests/recette-reelle.md), sections 1 à 5 et 7.
3. Corriger chaque écart, puis rejouer l'étape concernée. Un écart n'est clos qu'une fois rejoué en production.

## Étape 3 : conformité

1. Obtenir l'avis écrit du juriste ([questions](../reference/conformite.md)).
2. Adhérer à un médiateur, renseigner son nom dans `apps/web/app/(public)/cgv/page.tsx`.
3. Appliquer les corrections demandées aux pages légales.
4. Retirer la mention « version de travail » de `apps/web/src/features/shell/legal-page.tsx`.
5. Signer les accords de traitement manquants avec chaque sous-traitant.

## Étape 4 : retirer les données fictives et répéter

1. `pnpm --filter @tartan/web demo:fill <e-mail> --retirer` pour le compte du fondateur.
2. Répétition complète en production avec un compte neuf : landing, création d'espace, invitation, séance, validation, paiement, résiliation, suppression du compte.
3. Vérifier que `/admin/configuration` n'indique plus aucun « À faire ».

## Étape 5 : ouvrir

Décision du fondateur uniquement, portes franchies ([commercialisation](commercialisation.md)).

1. `/admin/configuration` → Inscriptions : Ouvertes à tous.
2. Dans la minute, la landing affiche « Créer mon espace coach ».
3. Un compte neuf crée son espace et atteint la page de paiement.

## Étape 6 : surveiller 72 heures

Chaque jour : Sentry, livraisons des webhooks Stripe, Resend (rebonds, plaintes), capacité Mux, consommation Neon, écran Opérations de la console, livraison des notifications.

## Retour arrière

| Problème | Geste |
| --- | --- |
| Défaut d'inscription | Configuration → Inscriptions : Fermées |
| Défaut de paiement | Configuration → Vente : Coupée. Le portail et les webhooks continuent |
| Défaut applicatif | Promouvoir le déploiement précédent sur Vercel. Les migrations sont additives et restent en place |
| Défaut du planificateur IA | Console → Couper l'IA partout |
| Perte de données | [Restauration](../exploitation/sauvegarde.md) |

Pendant un incident de vente, ne redéploie pas aveuglément une ancienne logique de Checkout : elle ignorerait les intentions en attente. Préfère un correctif en avant.
