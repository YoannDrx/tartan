# Livraison de l'ouverture commerciale — suivi d'exécution

Décision du fondateur du 8 novembre 2026 : une seule PR, découpée en commits, sur la branche `feat/ouverture-commerciale`, puis ouverture de la vente sur le web et la PWA. iOS et Android suivent sans la retarder.

Ce document distingue trois états : code livré dans la PR, testé automatiquement, éprouvé en réel. Rien n'est fusionné, activé ni configuré en production sans accord explicite.

| Lot | Contenu | État |
| --- | --- | --- |
| 0 | Remise à plat des documents et des données de démonstration | Livré dans la branche |
| 1 | Vues Liste et Mois, coach et athlète | Livré dans la branche ; tests automatiques verts, simulateur iOS à éprouver avec le lot 6 |
| 2 | Centre de notifications, notes de version, mises à jour | Livré dans la branche ; tests serveur verts. Skew Protection à activer dans Vercel. Android : disponibilité store confirmée à la main depuis la console. Push réels à éprouver |
| 3 | Console d'administration, remboursements | Livré dans la branche ; tests verts. À faire avant usage : `ADMIN_EMAILS`, `ADMIN_BOOTSTRAP_TOKEN`, `PASSKEY_RP_ID`, webhooks Stripe élargis, vrai remboursement éprouvé |
| 4 | Lien vidéo-exercice, « À travailler », bibliothèque, mobile terrain | À faire |
| 5 | Activation, IA bêta, relances, export d'espace, Sentry | À faire |
| 6 | Landing, vraies captures | À faire |
