# Livraison de l'ouverture commerciale — suivi d'exécution

Décision du fondateur du 8 novembre 2026 : une seule PR, découpée en commits, sur la branche `feat/ouverture-commerciale`, puis ouverture de la vente sur le web et la PWA. iOS et Android suivent sans la retarder.

Ce document distingue trois états : code livré dans la PR, testé automatiquement, éprouvé en réel. Rien n'est fusionné, activé ni configuré en production sans accord explicite.

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
- Index trigrammes de la recherche d'administration vérifiés en local sur PostgreSQL 17, y compris avec un rôle non superutilisateur. `CREATE EXTENSION pg_trgm` n'a jamais été joué sur Neon ni sur la CI : à surveiller à la première migration.
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
| 3   | Clé OpenAI révoquée et remplacée, corpus rejoué aux seuils                                                                                                                       | Fondateur, puis code                  |
| 4   | Vrai paiement, facture, résiliation, remboursement depuis l'administration                                                                                                       | Fondateur                             |
| 5   | Webhooks Stripe élargis, `RESEND_WEBHOOK_SECRET`, sonde et `CRON_HEARTBEAT_*`, `ADMIN_EMAILS`, `ADMIN_BOOTSTRAP_TOKEN`, `PASSKEY_RP_ID`, passkey enrôlée, Skew Protection Vercel | Configuration, accord à chaque action |
| 6   | Carte Mux et retrait de `MUX_VIDEO_LIMIT`, passage à Neon Launch                                                                                                                 | Fondateur, puis configuration         |
| 7   | E-mails reçus sur Gmail, Outlook, Apple Mail                                                                                                                                     | Fondateur                             |
| 8   | Recette iPhone et Android physiques, push web, hors ligne au stade                                                                                                               | Fondateur                             |
| 9   | Compte neuf : de l'inscription au paiement, sans aide                                                                                                                            | Fondateur                             |

Stores, en parallèle : clé APNs, Firebase, `APPLE_TEAM_ID` et empreintes des liens universels, build signé du commit validé, TestFlight, test fermé Google, soumission.

## Après la fusion

Migrations additives uniquement, sauvegarde restaurée avant la migration de production. La migration `20261109140000_open_v1_1_features` active progression et phases pour les espaces existants : à annoncer aux deux espaces pilotes. Le mécanisme de mise à jour n'atteint que les binaires qui le contiennent : il doit être dans le premier build soumis aux stores.
