# Automatiser les tests : feuille de route

Objectif : que chaque fonction soit vérifiée automatiquement, avec chaque rôle, et que seul ce qui exige un humain reste en [recette réelle](recette-reelle.md).

Le bug du webhook Mux montre la méthode à suivre : **teste la frontière réelle**, avec une vraie signature, un vrai handler, une vraie classe d'erreur du SDK. Un mock de service prouve le service, pas l'intégration.

## Mode d'emploi pour un agent

1. Prends les tâches dans l'ordre. Une frontière, une PR : les tests critiques se livrent en cinq PR (personas et T04 ; T01 et T02 ; T05 et T06 ; T07 et T08 ; T03), dans l'ordre des lots A1 à A7 de [web.md](../plans/web.md).
2. Lis un test voisin avant d'écrire. Modèles : `tests/mux-webhook.test.ts` (webhook signé), `tests/resend-webhook.test.ts` (route), `e2e/admin-passkey.spec.ts` (Chromium et authentificateur virtuel), `e2e/ai-disabled.spec.ts` (client natif dans Playwright), `tests/helpers.ts`, `e2e/helpers.ts`, `e2e/journeys.ts`.
3. Une tâche est finie quand son test échoue sans le code, passe avec, et tourne en CI.
4. Si un test révèle un bug, corrige-le dans la même PR, et mets à jour [ETAT.md](../ETAT.md).

## Fondation : les personas

Crée d'abord `apps/web/e2e/personas.ts` et son équivalent Vitest. Un appel construit, en base, les comptes de [comptes.md](comptes.md) avec leurs espaces, groupes et offres. Ensuite, décris l'accès attendu dans un tableau, plutôt que de répéter les tests :

```ts
const matrix = [
  { route: "GET /api/v1/orgs/:org/athlete/today", anonyme: 401, autreEspace: 403, athlete: 200, coach: 403 },
  // Une ligne par route : ajouter une route sans ligne fait échouer le test.
];
```

Le test parcourt `app/api/**/route.ts` et échoue pour toute route absente du tableau : c'est ce qui rend la couverture durable.

## Critique, avant la vente

| N° | Sujet | Test à écrire | Fini quand |
| --- | --- | --- | --- |
| T01 | Webhook Stripe jamais appelé | `tests/stripe-webhook-route.test.ts`, signature par `stripe.webhooks.generateTestHeaderString` | Valide, invalide, absente, secret manquant, doublon, panne en 500 |
| T02 | Webhook RevenueCat | Handler : sans en-tête 401, charge invalide 400, nominal, rejeu | Les quatre cas |
| T03 | Paiement de bout en bout | Fait. `tests-sandbox/payment-cycle.test.ts` : carte de test, `stripe listen --forward-to` vers la vraie route, offre, facture, e-mails, remboursement, résiliation, validation bancaire en fin d'essai. Hors CI, voir [stripe.md](../plans/stripe.md#recette-automatisée-en-sandbox) | Le cycle passe en sandbox |
| T04 | Matrice d'accès HTTP | `e2e/api-authz.spec.ts` ou table Vitest, sur les personas. Priorité : `me/export`, `o/export`, `o/tracking/export`, `o/athlete/*`, `o/videos*`, `o/comments`, `o/billing` | Toute route figure dans la matrice |
| T05 | Actions d'administration | Fait. `tests/admin-console-actions.test.ts` appelle les actions serveur de la console avec une vraie session : accorder, expiration, suspendre, supprimer, résilier, prolonger l'essai, rembourser. Refus, step-up, journal, effet | Six actions couvertes. Le remboursement passe par le SDK Stripe réel, réseau remplacé, et non par Playwright : le serveur e2e ne peut pas simuler Stripe |
| T06 | Export comptable | Fait. `tests/admin-accounting-export.test.ts` sur le handler de `admin/revenus/export` : non admin refusé, step-up, aucune donnée de santé ni personnelle. La route figure aussi dans la matrice d'accès | Trois assertions |
| T07 | Suppression de compte | Fait côté web : `e2e/account-deletion.spec.ts` supprime le compte par `api-client`, avec un second appareil connecté. Flux Maestro `apps/mobile/.maestro/destructive/account-delete.yml` écrit, à exécuter avec T09 | Compte effacé, sessions coupées |
| T08 | Connexion Apple et Google | Fait. `tests/auth-social.test.ts` : activation par variables, parcours OAuth Google complet avec liaison de comptes, révocation Apple à la suppression. La révocation d'une connexion native passe par le code d'autorisation (M6, même fichier de test) | Tests verts. Recette réelle à faire le jour où un fournisseur est activé |

## Élevé

| N° | Sujet | Test à écrire |
| --- | --- | --- |
| T09 | Mobile sans rendu | Job macOS : build simulateur et Maestro sur API locale. Retirer les `runFlow: when`, jeu de données dédié, `coach-tracking` ouvre vraiment l'appel |
| T10 | Vidéo en HTTP | Handlers de `o/videos`, `/upload`, `/share`, `/annotations*` avec `@/lib/mux` simulé, reprise de `upload-queue.ts` |
| T11 | Cron horaire | Fait. `tests/technical-routes.test.ts` : jeton absent ou faux refusé, horloge figée et clés de résultat, une tâche en panne rend 500 avec son seul nom, sans le message d'erreur, et les autres tournent |
| T12 | Invitation nominative | Fait. `e2e/staff-invitation.spec.ts` : invitation depuis les réglages, e-mail en file au gabarit du staff, lien lu dans la liste, compte créé depuis le lien, droits d'un coach (lecture oui, invitation d'un coach et rôle non), lien à usage unique |
| T13 | Changement d'espace | Fait. `e2e/space-switch.spec.ts` : compte coach chez lui et athlète ailleurs, sélecteur et cookie `tartan_space`, rôle propre à chaque espace, cookie forgé vers un espace étranger sans effet ni fuite |
| T14 | `/abonnement` | Fait. `e2e/subscription.spec.ts`, vente coupée faute de clé Stripe : sixième fiche refusée en Découverte avec un lien vers les offres, offre en cours, prise de contact sans bouton de paiement ; rien à acheter en pilote ; ni grille ni gestion pour un coach invité. Le bouton de paiement, vente ouverte, reste couvert par T03 en sandbox |
| T15 | Parrainage | Fait. `tests/access-guards.test.ts` sur le handler `r/[code]` : cookie de 30 jours en majuscules, domaine `.tartan.coach` et connexion sur l'application en production, code mal formé sans cookie |
| T16 | Limiteur Better Auth | Fait. Même fichier : `rateLimitEnabled` (actif sur Vercel en production même si un test demande de le couper), stockage en base, règles serrées sur `sign-in`, `sign-up` et `magic-link` |
| T17 | Step-up | Fait. Même fichier : `requireStepUp` (non-admin, sans passkey, 12 h pour lire, 10 min pour l'argent, contournement inopérant sur Vercel), mise en page de la console, chaque action en `adminAction`, chaque route avec `requireStepUp` |

## Moyen

| N° | Sujet | Test à écrire |
| --- | --- | --- |
| T18 | Centre de notifications | Fait. `e2e/notification-center.spec.ts` : compteur de la cloche, ligne ouverte puis lue, tout marquer comme lu, demande sans cible refusée ; nouveautés annoncées une fois, identifiant inconnu sans effet. Le test a révélé une cloche figée après « Tout marquer comme lu », corrigée |
| T19 | Pages sans e2e | Fait. `e2e/filled-pages.spec.ts` : compte rempli par `demo:fill`, vidéo partagée posée en base ; `/mes-sauts`, `/mes-sauts/[id]` avec la remarque du coach, `/progres`, `/seances/[id]/charges`, sans débordement ni erreur axe à 390 px. Projet mobile seul : le remplissage ne tourne qu'une fois par base |
| T20 | Console | Fait. `e2e/admin-console.spec.ts` ouvre la fiche de l'espace de l'éditeur et celle d'une facture d'essai posée en base : titre, mode test, montant, sans débordement ni erreur axe |
| T21 | Worker | Fait. `tests/service-worker.test.ts` charge le vrai `public/sw.js` dans un faux worker : notification affichée telle quelle ou neutre sans contenu, clic qui réutilise une fenêtre, réponse depuis la notification, API et autres sites jamais interceptés, page gardée puis page hors ligne sans réseau |
| T22 | Routes techniques | Fait. Même fichier : `health` à 200 puis 503 base coupée, `live` sans base, `version` sans cache, flux `ical` d'un athlète (séance, lieu, fin, sans le mot du coach), jeton faux et lien révoqué refusés |
| T23 | IA réelle | Hors CI, par choix : chaque passage appelle OpenAI et coûte. Le fondateur le lance avant chaque changement de modèle ou de consigne, et une fois par mois tant que l'IA est ouverte : `corepack pnpm --filter @tartan/web eval:planner --live --output .local/planner-eval-AAAA-MM.json`, avec la clé de production dans `.env.local`. Seuils de [planificateur-ia](../reference/planificateur-ia.md) : 57/60, aucune date fausse, aucune charge inventée. Premier passage dû après F6 et le passage à `gpt-transcribe` |
| T24 | Écrans natifs | Hors CI tant que M2 n'existe pas : un flux Maestro par écran (planificateur, constructeur, capture, synchronisation, phases), joué sur simulateur avec un build de développement et l'API locale. Maestro n'est pas installé sur le poste de développement : l'installer (`curl -Ls "https://get.maestro.mobile.dev" \| bash`) relève du fondateur. Les flux de M4 (changement de compte) et de M5 (vidéo juste encodée) s'ajoutent à cette liste |

## Faible

| N° | Sujet | Test à écrire |
| --- | --- | --- |
| T25 | `manifest`, `robots`, `sitemap` | Fait. Même fichier, sans navigateur : chaque page du plan du site existe et est permise aux robots, l'application reste fermée, icônes et raccourcis du manifeste existent |
| T26 | Parcours parental | Seulement si `PARENTAL_FLOW_ENABLED` est activé un jour |

## Une fois la vente ouverte

Ajoute un parcours synthétique sur la Preview, avec un compte dédié, jamais sur la production : connexion, création de séance, validation. Une fois par nuit, l'échec remonte dans Sentry.

## Ce qui ne s'automatise pas

E-mails reçus dans les vraies boîtes, push sur téléphones, passkey sur appareil, vrai paiement, dictées réelles, usage au stade. C'est l'objet de la [recette réelle](recette-reelle.md).
