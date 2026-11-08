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
| 5   | Activation, IA bêta, relances, export d'espace, Sentry                                            | Livré dans la branche ; tests verts. IA : corpus à rejouer avec une nouvelle clé avant `AI_PLANNER_ENABLED=true`                                                               |
| 6   | Landing, vraies captures                                                                          | Livré dans la branche ; captures iOS Release et web sur données fictives, procédure dans `preuves-v1-1/captures-landing.md`                                                    |

## Écarts au plan

- Captures iOS prises par `simctl` et liens profonds sur un build Release, sans Maestro ni script `pnpm captures` unique.
- Android : la disponibilité sur le store se confirme à la main dans la console d'administration, sans API Play.
- Recherche d'administration en `contains`, sans index trigrammes.
- Lien vidéo-exercice posé depuis l'analyse web, filtre `?exercice=` sur `/videos`, pas de fiche exercice web.
- Corpus IA non rejoué : la clé OpenAI doit d'abord être remplacée. `AI_PLANNER_ENABLED` reste à `false`.
- Passes UI/UX Pro Max et Frontend Design non effectuées sur la landing : seule la grille de qualité d'Impeccable a été appliquée.

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
