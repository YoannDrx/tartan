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
| T03 | Paiement de bout en bout | Étendre `tests-sandbox/` : carte de test, `stripe listen --forward-to`, offre, facture, e-mail, remboursement, résiliation | Le cycle passe en sandbox |
| T04 | Matrice d'accès HTTP | `e2e/api-authz.spec.ts` ou table Vitest, sur les personas. Priorité : `me/export`, `o/export`, `o/tracking/export`, `o/athlete/*`, `o/videos*`, `o/comments`, `o/billing` | Toute route figure dans la matrice |
| T05 | Actions d'administration | Fait. `tests/admin-console-actions.test.ts` appelle les actions serveur de la console avec une vraie session : accorder, expiration, suspendre, supprimer, résilier, prolonger l'essai, rembourser. Refus, step-up, journal, effet | Six actions couvertes. Le remboursement passe par le SDK Stripe réel, réseau remplacé, et non par Playwright : le serveur e2e ne peut pas simuler Stripe |
| T06 | Export comptable | Fait. `tests/admin-accounting-export.test.ts` sur le handler de `admin/revenus/export` : non admin refusé, step-up, aucune donnée de santé ni personnelle. La route figure aussi dans la matrice d'accès | Trois assertions |
| T07 | Suppression de compte | Fait côté web : `e2e/account-deletion.spec.ts` supprime le compte par `api-client`, avec un second appareil connecté. Flux Maestro `apps/mobile/.maestro/destructive/account-delete.yml` écrit, à exécuter avec T09 | Compte effacé, sessions coupées |
| T08 | Connexion Apple et Google | Fait. `tests/auth-social.test.ts` : activation par variables, parcours OAuth Google complet avec liaison de comptes, révocation Apple à la suppression. La révocation reste incomplète pour une connexion native (M6) : ne pas activer Apple avant | Tests verts. Recette réelle à faire le jour où un fournisseur est activé |

## Élevé

| N° | Sujet | Test à écrire |
| --- | --- | --- |
| T09 | Mobile sans rendu | Job macOS : build simulateur et Maestro sur API locale. Retirer les `runFlow: when`, jeu de données dédié, `coach-tracking` ouvre vraiment l'appel |
| T10 | Vidéo en HTTP | Handlers de `o/videos`, `/upload`, `/share`, `/annotations*` avec `@/lib/mux` simulé, reprise de `upload-queue.ts` |
| T11 | Cron horaire | Handler de `cron/hourly` avec jeton valide, horloge figée, clés de résultat, 500 si erreur |
| T12 | Invitation nominative | `e2e/staff-invitation.spec.ts` : lien récupéré, droits vérifiés |
| T13 | Changement d'espace | Compte double rôle, cookie `tartan_space`, aucune fuite entre espaces |
| T14 | `/abonnement` | E2E avec Stripe simulé : boutons selon offre et rôle, vente coupée, blocage du 6e athlète |
| T15 | Parrainage | Handler `r/[code]` : cookie, code invalide, domaine de production |
| T16 | Limiteur Better Auth | Test de configuration, ou passe `E2E_PROD` sans `E2E_DISABLE_RATE_LIMIT` |
| T17 | Step-up | Vitest sur `requireStepUp`, pour chaque page d'administration |

## Moyen

| N° | Sujet | Test à écrire |
| --- | --- | --- |
| T18 | Centre de notifications | E2E : notification insérée, lue, compteur. `/notifications/read`, `/releases/seen` |
| T19 | Pages sans e2e | `/mes-sauts*`, `/progres`, `/seances/[id]/charges`, avec données et axe |
| T20 | Console | `espaces/[id]` et `factures/[id]` dans `admin-console.spec.ts` |
| T21 | Worker | Faux `self` pour `public/sw.js` : push au contenu neutre, clic |
| T22 | Routes techniques | `health` (base coupée), `live`, `version`, `ical/*` |
| T23 | IA réelle | `eval:planner --live` planifié hors CI, seuils de [planificateur-ia](../reference/planificateur-ia.md) |
| T24 | Écrans natifs | Un flux Maestro par écran : planificateur, constructeur, capture, synchronisation, phases |

## Faible

| N° | Sujet | Test à écrire |
| --- | --- | --- |
| T25 | `manifest`, `robots`, `sitemap` | Vérification de réponse dans `e2e/pilot.spec.ts` |
| T26 | Parcours parental | Seulement si `PARENTAL_FLOW_ENABLED` est activé un jour |

## Une fois la vente ouverte

Ajoute un parcours synthétique sur la Preview, avec un compte dédié, jamais sur la production : connexion, création de séance, validation. Une fois par nuit, l'échec remonte dans Sentry.

## Ce qui ne s'automatise pas

E-mails reçus dans les vraies boîtes, push sur téléphones, passkey sur appareil, vrai paiement, dictées réelles, usage au stade. C'est l'objet de la [recette réelle](recette-reelle.md).
