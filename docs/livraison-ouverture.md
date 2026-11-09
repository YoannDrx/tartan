# Livraison de l'ouverture commerciale — suivi d'exécution

Décision du fondateur du 8 novembre 2026 : une seule PR, découpée en commits, sur la branche `feat/ouverture-commerciale`, puis ouverture de la vente sur le web et la PWA. iOS et Android suivent sans la retarder.

Ce document distingue trois états : code livré, testé automatiquement, éprouvé en réel. Aucune fonction n'est ouverte à la vente sans accord explicite.

## Où on en est, au 9 novembre 2026

Le code des lots 0 à 6 est fusionné dans `main` sur accord du fondateur (PR 47). La fusion n'ouvre pas la vente : les inscriptions restent fermées tant que `COACH_SIGNUP_MODE` n'est pas passé à `public`, ce qui suppose les portes ci-dessous.

| Domaine | État |
| --- | --- |
| Identité | Thème Tartan par défaut (piste, cartes encre, citron), Automatique, Clair et Sombre au choix, web et mobile |
| Site | Film du personnage en ouverture, une seule piste continue, vraies captures dans ce thème |
| Planification | Liste, Semaine et Mois, coach et athlète, choix suivi d'un appareil à l'autre |
| IA | Parcours complet web et mobile, éprouvé de bout en bout sur le web avec OpenAI et des données fictives. S'active dès qu'une clé est présente sur le serveur |
| Notifications et versions | Centre de notifications, préférences, notes de version, bandeau et écran de mise à jour, version minimale |
| Administration | Console complète derrière passkey ; à configurer avant usage |

## Ce qu'il reste à faire

La recette à dérouler pas à pas : [Tartan : recette réelle pas à pas](https://claude.ai/artifact/UVLfXFqajbccsSTv26s6k5).

Par ordre d'impact sur l'ouverture :

1. Régulariser la facturation GitHub Actions : la CI ne démarre plus depuis le 9 novembre.
2. Poser `OPENAI_API_KEY` sur Vercel. La clé actuelle reste à remplacer avant l'ouverture.
3. Poser `ADMIN_BOOTSTRAP_TOKEN`, enrôler la passkey sur `/verification-admin`, puis retirer le jeton.
4. Créer le webhook Resend, poser `RESEND_WEBHOOK_SECRET`. Décider de l'expéditeur : `tartan@yodev.fr` aujourd'hui.
5. Consulter le juriste : HDS, vidéos, OpenAI et accord de traitement, conservation. Désigner le médiateur, valider les CGV, retirer la mention « version de travail ».
6. Lever les plafonds : carte Mux, Neon Launch, puis réglage du plafond vidéo depuis Configuration.
7. Dérouler la recette réelle.
8. Publier sur les stores.
9. Annoncer aux deux espaces pilotes l'activation de la progression, des phases et de l'IA.

Configuration de production faite le 9 novembre 2026 : webhook Stripe sur 14 événements, `PASSKEY_RP_ID`, `APPLE_TEAM_ID`, `ADMIN_EMAILS`, `CRON_HEARTBEAT_*`. La sonde des crons horaires tourne sur Sentry ; la sonde de disponibilité et celle des notifications sont créées mais désactivées, faute de place sur l'offre Sentry. Skew Protection refusée par l'API Vercel : à activer dans le tableau de bord si l'offre l'inclut.

## Niveau de preuve par fonction, au 9 novembre 2026

| Fonction | Preuve |
| --- | --- |
| Webhooks Mux et Resend | Route et signature réelles en test |
| Webhook Stripe | Service testé avec Stripe simulé ; signature jamais testée ; à prouver par la recette |
| RevenueCat | Route non testée, canal inactif |
| Paiement réel, renouvellement, miroir de factures | Non prouvés : recette |
| Remboursement | Chemin nominal et refus définitif testés avec la vraie classe d'erreur Stripe ; réel à prouver |
| Crons | Tâches testées séparément ; enchaînement horaire complet jamais exécuté en test |
| Invitation | Service et parcours e2e ; e-mail réel à prouver |
| Push Expo et web | Envoi simulé ; réel à prouver |
| E-mails | Gabarits rendus en test ; réception à prouver depuis Configuration |
| Suppression de compte | Base réelle, prestataires simulés. Révocation Apple incomplète, à corriger si la connexion Apple est activée sur iOS |
| OpenAI | Prestataire simulé en test, corpus réel 59/60, essai réel web |

## Détail par lot

| Lot | Contenu                                                                                           | État                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Remise à plat des documents et des données de démonstration                                       | Livré dans la branche                                                                                                                                                          |
| 1   | Vues Liste et Mois, coach et athlète                                                              | Livré dans la branche ; tests automatiques verts, simulateur iOS à éprouver avec le lot 6                                                                                      |
| 2   | Centre de notifications, notes de version, mises à jour                                           | Livré dans la branche ; tests serveur verts. Skew Protection à activer dans Vercel. Android : disponibilité store confirmée à la main depuis la console. Push réels à éprouver |
| 3   | Console d'administration, remboursements                                                          | Livré dans la branche ; tests verts. À faire avant usage : `ADMIN_EMAILS`, `ADMIN_BOOTSTRAP_TOKEN`, `PASSKEY_RP_ID`, webhooks Stripe élargis, vrai remboursement éprouvé       |
| 4   | Lien vidéo-exercice, « À travailler », bibliothèque, modèles de départ, préférences e-mail mobile | Livré dans la branche ; tests verts. Le lien se pose depuis l'analyse web                                                                                                      |
| 5   | Activation, IA bêta, relances, export d'espace, Sentry                                            | Livré dans la branche ; tests verts. IA : corpus 59/60 sur texte fictif, active dès qu'une clé est configurée                                                               |
| 6   | Landing, vraies captures                                                                          | Livré dans la branche ; captures iOS Release et web sur données fictives, procédure dans `preuves-v1-1/captures-landing.md`                                                    |

## Écarts au plan

- `pnpm captures` remplace Maestro et a produit les captures iOS du site le 9 novembre 2026, sur simulateur et build Release. La connexion de l'athlète dans l'app reste manuelle (`docs/preuves-v1-1/captures-landing.md`).
- Android : `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` active la lecture de Google Play, testée sur des réponses simulées, jamais contre Google. Une version n'est annoncée que publiée après revue et servie à 100 % : un déploiement progressif se confirme à la main, comme tout échec de lecture ou absence d'identifiants. Le nom de la sortie doit porter la version (`1.2.0` ou `12 (1.2.0)`). Les droits exacts du compte de service dans la Play Console restent à établir à la création du compte.
- Index trigrammes de la recherche d'administration appliqués sur Neon le 9 novembre 2026.
- Fiche exercice web et lien vidéo-exercice natif : services et rendu testés, fiche web revue en thème Tartan, écran natif non ouvert sur un appareil.
- Corpus IA rejoué le 9 novembre 2026 : 59/60, 0 date fausse, 0 charge inventée (`gpt-4.1-mini`, détail dans `preuves-v1-1/lot-e-corpus-ia.md`). Texte fictif seulement : dictées réelles, téléphones physiques et corrections par des coachs restent à mesurer. L'IA s'ouvre dès qu'une clé est configurée ; `AI_PLANNER_ENABLED=false` la coupe. La clé OpenAI reste à faire tourner.
- Passes UI/UX Pro Max, Frontend Design et Impeccable faites le 9 novembre 2026 sur la landing et toutes les pages web : 126 vues à 1440 et 390 px, relues à l'œil, axe sans violation, aucun débordement. Écrans natifs de l'athlète revus sur simulateur ; écrans natifs du coach couverts seulement par les tests de contraste des palettes, jamais ouverts dans ce thème.

## Ce que les tests ne prouvent pas

Push réels, vrai paiement et vrai remboursement, e-mails reçus, téléphones physiques, passkey d'administration sur le domaine de production.

## Portes de l'ouverture

`COACH_SIGNUP_MODE=public` ne bascule qu'avec l'accord du fondateur, une fois ces points cochés.

| #   | Condition                                                                                                                                                                        | Qui                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1   | Avis écrit du juriste : HDS, vidéos, OpenAI, conservation                                                                                                                        | Fondateur                             |
| 2   | Médiateur désigné, CGV complétées, mention « version de travail » retirée                                                                                                        | Fondateur, puis code                  |
| 3   | Clé OpenAI révoquée et remplacée (corpus aux seuils le 9 novembre 2026 : 59/60)                                                                                                  | Fondateur, puis configuration         |
| 4   | Vrai paiement, facture, résiliation, remboursement depuis l'administration                                                                                                       | Fondateur                             |
| 5   | Webhooks Stripe élargis, `RESEND_WEBHOOK_SECRET`, sonde et `CRON_HEARTBEAT_*`, `ADMIN_EMAILS`, `ADMIN_BOOTSTRAP_TOKEN`, `PASSKEY_RP_ID`, passkey enrôlée, Skew Protection Vercel | Configuration, accord à chaque action |
| 6   | Carte Mux et retrait de `MUX_VIDEO_LIMIT`, passage à Neon Launch                                                                                                                 | Fondateur, puis configuration         |
| 7   | E-mails reçus sur Gmail, Outlook, Apple Mail                                                                                                                                     | Fondateur                             |
| 8   | Recette iPhone et Android physiques, push web, hors ligne au stade                                                                                                               | Fondateur                             |
| 9   | Compte neuf : de l'inscription au paiement, sans aide                                                                                                                            | Fondateur                             |

Stores, en parallèle : clé APNs, Firebase, `APPLE_TEAM_ID` et empreintes des liens universels, build signé du commit validé, TestFlight, test fermé Google, soumission.

## Après la fusion

Migrations additives uniquement, sauvegarde restaurée avant la migration de production. La migration `20261109140000_open_v1_1_features` active progression et phases pour les espaces existants : à annoncer aux deux espaces pilotes. Le mécanisme de mise à jour n'atteint que les binaires qui le contiennent : il doit être dans le premier build soumis aux stores.
