# Stripe — configuration et recette

Le compte de production Tartan et sa sandbox doivent avoir leurs propres clés, tarifs, portail et secrets de webhook. La sandbox dédiée identifiée le 7 novembre 2026 est `acct_1UXJsn7nmxxw9EFI`. Ne jamais tester avec des clients de production.

## Configurer un environnement

Le script `apps/web/scripts/stripe-setup.ts` exige ces variables serveur :

- `STRIPE_SECRET_KEY` : de préférence une clé restreinte avec les permissions nécessaires au catalogue, au portail et aux webhooks ; `rk_test_…` en sandbox, `rk_live_…` en production.
- `STRIPE_SETUP_MODE` : `sandbox` ou `production`.
- `STRIPE_EXPECTED_ACCOUNT_ID` : identifiant du compte à configurer. Le script relit le compte associé à la clé avant toute mutation.
- `STRIPE_SETUP_APP_URL` : origine HTTPS de l'application cible, sans chemin. Une sandbox refuse les domaines de production Tartan.
- `STRIPE_SETUP_OUTPUT_FILE` : chemin d'un **nouveau fichier privé hors du dépôt**, pour récupérer les identifiants et le secret de signature du webhook. Aucun secret n'est imprimé. Le fichier est créé en mode `0600` et n'est jamais écrasé.

Après avoir chargé ces variables dans l'environnement du processus, depuis la racine :

```sh
corepack pnpm --filter @tartan/web exec tsx scripts/stripe-setup.ts
```

Le script retrouve les produits via leurs lookup keys, vérifie les tarifs et met à jour le portail Tartan. Il réutilise ou crée le webhook de l'origine explicitement fournie. Un nouveau webhook utilise la version d'API du SDK installé ; la version d'un webhook existant n'est pas changée silencieusement. Son secret n'est retourné par Stripe qu'à sa création : une nouvelle exécution conserve donc le secret déjà configuré dans Vercel.

Installer les valeurs du fichier privé dans **le seul environnement Vercel visé**, puis retirer le fichier après transfert. Ne pas installer une clé de sandbox en production. Une Preview protégée doit rendre son endpoint accessible à Stripe via une configuration d'accès dédiée ; une réponse de la page d'authentification Vercel ne prouve pas la réception du webhook. Ne pas désactiver globalement les protections de production pour ce test.

## Recette bloquante

1. Créer un espace de test et ouvrir simultanément deux demandes d'abonnement. Vérifier une seule session ouverte chez Stripe.
2. Interrompre le retour du premier appel après création, reprendre et vérifier le même identifiant de session.
3. Changer d'offre : l'ancienne session doit être confirmée expirée avant la nouvelle.
4. Terminer le Checkout avec les moyens de paiement de test Stripe ; vérifier l'abonnement, les droits, la facture et la réception du webhook signé.
5. Rejouer un événement ; vérifier l'absence de droits ou d'e-mails dupliqués. Retarder un événement ancien et vérifier que l'état actuel Stripe fait foi.
6. Préparer un second coach, supprimer le propriétaire et provoquer une panne Stripe pendant le transfert. Vérifier la commande durable, la reprise, le maintien des droits payés et le refus d'accès de l'héritier au portail du partant.
7. Après clôture de l'ancien abonnement, vérifier que le repreneur obtient un nouveau client Stripe.
8. Vérifier la procédure d'anomalie pour deux abonnements vivants : aucun remboursement ni arrêt automatique.

Les tests locaux avec prestataire simulé ne remplacent pas cette recette. Le cycle réel contrôlé avant ouverture commerciale reste distinct du test sandbox.

### Recette automatisée avec le prestataire sandbox

`apps/web/tests-sandbox/billing.test.ts` appelle les services métier via un transport Stripe CLI authentifié. Les réponses du prestataire sont réelles ; seuls la perte de réponse et l'indisponibilité réseau sont injectées. Aucun secret Stripe n'est exporté vers Vitest. Ces tests sont exclus de `pnpm test` et de la CI ordinaire.

Prérequis : Node 22, Postgres local démarré, base jetable `tartan_v11_sandbox` créée sur le port 54329, session Stripe CLI connectée à la sandbox Tartan et quatre tarifs configurés. Fournir `TEST_DATABASE_URL` pour **cette seule base**, puis lancer :

```sh
RUN_STRIPE_SANDBOX=1 corepack pnpm --filter @tartan/web exec vitest run --config vitest.sandbox.config.mts
```

Le setup refuse tout autre hôte, port ou nom de base, vérifie le compte `acct_1UXJsn7nmxxw9EFI`, puis réinitialise cette base locale. La CLI ne reçoit jamais `--live` et ignore les clés Stripe éventuellement héritées du shell. La recette vérifie :

- session unique sous concurrence, réutilisation, expiration avant changement d'offre et récupération de réponse perdue ;
- transfert avec panne, reprise de l'arrêt à échéance, maintien des droits et portail de l'ancien payeur inaccessible ;
- nouveau client pour le repreneur après clôture de l'abonnement d'essai créé par la recette.

La fin de suite expire les Checkout encore ouverts et supprime uniquement les clients créés par cette exécution, en vérifiant la confirmation de suppression. Un échec de nettoyage fait échouer la suite. L'abonnement de recette utilise une période d'essai : cette suite **ne prouve pas** le paiement par carte, la facturation payée, la livraison HTTP d'un webhook signé ni la réception d'un e-mail.

## Fiscalité

`STRIPE_TAX_ENABLED=false` reste le défaut. Ne l'activer qu'après vérification du régime applicable et des immatriculations configurées : activer le calcul automatique seul ne suffit pas. Les mentions de facture doivent correspondre à la situation fiscale validée du vendeur.

Références : [webhooks Stripe](https://docs.stripe.com/webhooks), [configuration des webhooks existants](https://docs.stripe.com/api/webhook_endpoints/update), [taxes sur les abonnements](https://docs.stripe.com/billing/taxes/collect-taxes).
