# Plan : abonnements et Stripe

Le compte de production et la sandbox ont chacun leurs clés, tarifs, portail et secrets de webhook. Ne jamais tester avec des clients de production, hors le paiement réel contrôlé de la recette. L'avancement est dans [../ETAT.md](../ETAT.md).

## Fonctionnement

| Élément | Où |
| --- | --- |
| Offres et prix | `packages/domain/src/plans.ts` |
| Achat, portail | `apps/web/src/server/billing.service.ts` |
| Réconciliation d'un abonnement | `stripe-subscriptions.service.ts` |
| Écriture de l'état | `subscription-state.service.ts` (`applySubscription`, point unique) |
| Factures, remboursements, litiges | `billing-mirror.service.ts`, `billing-refund.service.ts` |
| Webhook | `apps/web/app/api/webhooks/stripe/route.ts` |
| Liste des événements | `apps/web/src/lib/stripe-webhook-events.ts` (14) |
| Vente coupée | `/admin/configuration`, ou `BILLING_CHECKOUT_ENABLED=false` |

La console affiche si le webhook couvre les 14 événements. La version d'API d'un webhook existant n'est jamais changée silencieusement.

## Configurer un environnement

`apps/web/scripts/stripe-setup.ts` crée ou réutilise produits, tarifs, portail et webhook. Variables requises :

- `STRIPE_SECRET_KEY` : clé restreinte de préférence, `rk_test_…` en sandbox, `rk_live_…` en production.
- `STRIPE_SETUP_MODE` : `sandbox` ou `production`.
- `STRIPE_EXPECTED_ACCOUNT_ID` : le script relit le compte avant toute écriture.
- `STRIPE_SETUP_APP_URL` : origine HTTPS, sans chemin. Une sandbox refuse les domaines de production.
- `STRIPE_SETUP_OUTPUT_FILE` : nouveau fichier privé hors du dépôt, en mode 600. Aucun secret n'est imprimé.

```sh
corepack pnpm --filter @tartan/web exec tsx scripts/stripe-setup.ts
```

Le secret de signature n'est rendu par Stripe qu'à la création du webhook. Une nouvelle exécution conserve celui déjà posé. Installe les valeurs dans le seul environnement Vercel visé, puis supprime le fichier.

## Recette automatisée en sandbox

`apps/web/tests-sandbox/billing.test.ts` appelle les services via un transport Stripe CLI. Réponses réelles, seules la perte de réponse et la panne sont injectées. Hors de `pnpm test` et de la CI.

Prérequis : Node 22, Postgres local, base `tartan_v11_sandbox` créée, session Stripe CLI connectée à la sandbox, quatre tarifs configurés.

```sh
RUN_STRIPE_SANDBOX=1 TEST_DATABASE_URL=postgresql://tartan@localhost:54329/tartan_v11_sandbox corepack pnpm --filter @tartan/web exec vitest run --config vitest.sandbox.config.mts
```

Prouve : session unique sous concurrence, réponse perdue, expiration avant changement d'offre, transfert avec panne, portail de l'ancien payeur refusé, nouveau client du repreneur. **Ne prouve pas** le paiement par carte, la facture payée, le webhook signé livré en HTTP, ni l'e-mail. Ce manque est la tâche T03.

## Tâches restantes

| N° | Action | Qui |
| --- | --- | --- |
| S1 | Test de la route webhook avec vraie signature (T01) | Agent |
| S2 | Paiement en sandbox de bout en bout, webhooks transmis par `stripe listen` (T03) | Agent |
| S3 | Vrai paiement, facture, résiliation, remboursement ([recette, section 5](../tests/recette-reelle.md)) | Fondateur |
| S4 | Confirmer le régime de TVA avec un comptable, seuil de franchise inclus | Fondateur |
| S5 | Expliquer dans l'aide que le portail met fin à l'essai lors d'un changement d'offre | Agent, après vérification en sandbox |

Cartes de test Stripe (mode test uniquement) : `4242 4242 4242 4242` accepte, `4000 0000 0000 0341` échoue au prélèvement après ajout, `4000 0025 0000 3155` demande 3-D Secure. Date future, CVC quelconque.

## Recette manuelle complète (en sandbox)

1. Créer un espace, ouvrir deux demandes d'abonnement simultanées : une seule session chez Stripe.
2. Interrompre le retour après création, reprendre : même session.
3. Changer d'offre : l'ancienne session est expirée avant la nouvelle.
4. Payer : abonnement, droits, facture et webhook signé reçus.
5. Rejouer un événement : ni droit ni e-mail en double. Retarder un événement ancien : l'état actuel de Stripe fait foi.
6. Préparer un second coach, supprimer le propriétaire, provoquer une panne Stripe pendant le transfert : commande durable, reprise, droits maintenus, portail du partant refusé à l'héritier.
7. Après clôture de l'ancien abonnement : le repreneur obtient un nouveau client Stripe.
8. Deux abonnements vivants : aucun remboursement ni arrêt automatique.

## Rapprochement en cas d'anomalie

- **Intention en revue :** relever espace, intention, génération, date et session dans la console. Chercher l'opération Stripe avec la clé `checkout-{id}-{generation}` et les métadonnées. Ne jamais remplacer une issue inconnue par une nouvelle clé après 24 h.
- **La session existe :** vérifier client et état, puis la rattacher à l'intention. Complète, elle conduit à la réconciliation. Ouverte, elle doit être expirée avec confirmation avant toute nouvelle génération.
- **Plusieurs abonnements :** vérifier chaque facture et moyen de paiement dans Stripe. La déduplication des webhooks ne justifie aucun remboursement.
- **Commande d'arrêt en attente :** contrôler le code d'erreur et l'état Stripe. La tâche reprend avec délai croissant.
- **E-mail en échec :** la reprise recontrôle destinataire et état. Ne pas rejouer un message obsolète.
- **Espace actif sans repreneur :** traiter sous 30 jours, organiser une reprise vérifiée, puis supprimer le compte inactif.

## Remboursement

`/admin/factures/[id]`. Préparation qui fige le montant, jeton de 10 minutes, montant retapé, passkey récente, nouvelle vérification chez Stripe, avoir émis. Motif en liste fermée. Un refus définitif de Stripe passe en échec et libère la facture.

## Fiscalité

`STRIPE_TAX_ENABLED=false` par défaut. À n'activer qu'après vérification du régime et des immatriculations. Les mentions de facture doivent correspondre à la situation validée du vendeur.

[Webhooks Stripe](https://docs.stripe.com/webhooks) · [Mise à jour d'un webhook](https://docs.stripe.com/api/webhook_endpoints/update) · [Cartes de test](https://docs.stripe.com/testing)
