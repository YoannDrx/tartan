# Plan : mettre la web app en état de vendre

Objectif : une web app et une PWA qu'un coach inconnu peut trouver, payer et utiliser sans aide. Le mobile natif suit sans retarder cette ouverture. L'avancement est dans [../ETAT.md](../ETAT.md).

## Étape 0 : finir le code de vente

Un lot, une branche, une PR. L'état de chaque lot est dans [../ETAT.md](../ETAT.md).

| Lot | Branche | Contenu | Fini quand |
| --- | --- | --- | --- |
| A1 | `test/personas-authz` | Personas, matrice d'accès T04, liste blanche des routes publiques | Toute route de `app/api/**/route.ts` a sa ligne |
| A2 | `test/webhooks-paiement` | T01 route du webhook Stripe avec vraie signature, T02 RevenueCat | Six cas Stripe, quatre RevenueCat |
| A3 | `feat/garde-fous-da` | Règles ESLint locales : pas de couleur brute, pas de palette par défaut, pas de texte en dur. Les textes existants sont gelés dans `eslint-suppressions.json`, qui ne peut que rétrécir | Toute nouvelle infraction échoue |
| A4 | `feat/paiement-finitions` | Événement `invoice.payment_action_required` et son e-mail ; bandeau d'impayé dans tout l'espace coach, pour le propriétaire ; plafond atteint : dialogue vers `/abonnement`, jamais dans l'app native ; page Factures ; réconciliation à curseur tournant ; CGV qui lisent `packages/domain/src/plans.ts` | Test de route, e2e `/abonnement` |
| A5 | `test/admin-actions` | T05, T06 | Six actions, export |
| A6 | `test/compte-social` | T07, T08 | Tests verts |
| A7 | `test/stripe-sandbox` | T03, avec une session Stripe CLI du fondateur | Cycle complet en sandbox |
| A8 | `feat/email-registry` | Registre unique des e-mails, catégorie obligatoire à l'envoi, e-mails de sécurité exemptés des plaintes et désinscriptions, invitations par la file, objets dans `packages/i18n` | Rendu de chaque genre, aucun nouvel e-mail |
| A9 | `feat/premiers-pas-coach` | Onboarding en trois temps, liste « Premiers pas » sur `/suivi` | E2E d'un coach neuf à 390 px |
| A10 | `feat/emails-cycle-de-vie` | Séquences d'activation, essai, plafond, reconquête ; préférences | Tests à horloge figée |
| A11 | `feat/accueil-athlete` | Accueil après invitation, e-mail de bienvenue, relance d'invitation | E2E et axe à 390 px |
| A12 | `feat/aide` | Page `/aide`, aide courte par écran, contact dans l'application | E2E et axe |
| A13 | `feat/exploitation-vente` | W8 et W9 ci-dessous | Copie restaurée, panne simulée reçue |

Parallèles sans fichier commun : A1 avec A2, A5 avec A6, A8 avec A9. Le détail des e-mails est dans [emails.md](../reference/emails.md), celui des parcours dans [onboarding.md](../reference/onboarding.md).

Après A4, le fondateur relance `stripe-setup` en production pour ajouter l'événement au webhook : la console affiche le webhook incomplet d'ici là. Le rattrapage horaire des abonnements traite jusqu'à 200 espaces en 40 secondes au plus, les plus anciennement vérifiés d'abord.

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

## Après l'ouverture : ajouts décidés le 11 novembre 2026

| Lot | Branche | Contenu |
| --- | --- | --- |
| C1 | `feat/absence-athlete` | L'athlète signale qu'il ne viendra pas, motif en liste fermée sans donnée de santé ; visible dans le suivi et le centre de notifications du coach |
| C2 | `feat/regularite` | Série de régularité : règle pure dans `packages/domain`, affichée en tour de piste sur l'accueil de l'athlète et sur sa fiche côté coach |
| C3 | `feat/carte-record` | Image générée côté serveur avec l'athlète de l'épreuve, partagée par le menu du téléphone, sans donnée de santé |

La refonte visuelle et le jeu sont dans [direction-artistique.md](direction-artistique.md).

## Retour arrière

Les gestes sont dans [exploitation](../exploitation/README.md#retour-arrière) : inscriptions et vente depuis Configuration, déploiement précédent sur Vercel, coupure du planificateur IA, restauration.

Pendant un incident de vente, ne redéploie pas aveuglément une ancienne logique de Checkout : elle ignorerait les intentions en attente. Préfère un correctif en avant. La conduite d'un incident est dans [incident.md](../exploitation/incident.md).
