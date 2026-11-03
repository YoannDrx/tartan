# Finition de Tartan

Objectif accepté le 3 novembre 2026 : implémenter le plan de l'audit, corriger les défauts et améliorer l'existant jusqu'à une version commercialisable. Référence : `audit-commercialisation-2026-11-03.md`. Les cases ne sont cochées qu'après vérification ; une correction locale n'est pas un déploiement.

## A — Fiabilité

- [ ] Notifications : tentatives persistantes par appareil/canal, erreurs web et Expo, receipts, reprise e-mail, concurrence, échecs visibles.
- [ ] Abonnements : désordre et concurrence des webhooks, synchronisation Stripe, Checkout simultanés, réconciliation.
- [ ] Médias Instagram : conservation à l'édition mobile et formulaire cohérent.
- [ ] Guide de démarrage : progression réelle du coach, première validation.
- [ ] Suppression et confidentialité : prestataires, cache hors ligne, retrait du consentement, reprise après erreur.

## B — Services

- [ ] Mux : capacité suffisante, coût/quota, upload réel et lecture signée.
- [ ] Isolation production/preview/développement : Blob, base, Mux, Stripe ; secrets et versions d'exécution.
- [ ] Liens universels Apple/Android : configuration réelle et essais après installation.
- [ ] Sauvegarde : restauration actuelle, clé indépendante du Mac, protection/capacité Neon.
- [ ] E-mails, surveillance : réception réelle, alertes de panne, métriques de livraison.

## C — Usage

- [ ] Parcours de première séance et invitation guidé.
- [ ] Constructeur progressif et aperçu athlète ; libellés des filtres vidéo.
- [ ] États synchronisation/reprise explicites ; actions après validation et aide.
- [ ] Appel et parcours coach à une main ; accessibilité et gros caractères.
- [ ] Retours coach et progression athlète utiles, sans multiplier les sollicitations.

## D — Recette terrain

- [ ] iPhone et Android : connexion, invitations, consentements, notifications, mode séance.
- [ ] Coupure réseau, redémarrage, reprise upload et stockage saturé.
- [ ] Vrais ralentis 120/240 i/s, arrière-plan, soleil, lecteurs d'écran.

## E — Vente

- [ ] Recette sandbox complète et recette réelle contrôlée : essai, paiement, droits, facture, renouvellement, impayé, remboursement, résiliation.
- [ ] Gestion des litiges, fraude et support ; cohérence prix, quotas et promesses.
- [ ] Textes et décisions juridiques : médiateur, santé/mineurs, sous-traitants, conservation, vidéos tierces, TVA.

## F — Distribution

- [ ] Builds actuels iOS/Android ; tests natifs, Firebase/FCM/APNs, CI mobile.
- [ ] TestFlight, Google Play, fiches de confidentialité et compte de revue.
- [ ] Décision achats intégrés et configuration cohérente avec l'offre publiée.

## G — Adoption et ouverture

- [ ] Pilote six semaines et retours ; critères du cahier mesurés.
- [ ] Répétition avec un nouveau coach, nettoyage démonstration approprié, lancement et surveillance.

## Journal des preuves

- 3 novembre : état de départ revérifié, `514c181`, arbre sans changement fonctionnel. Rapport et reproductions de l'audit conservés. Début de la correction des notifications.
- 3 novembre, lot notifications local : tentatives persistantes, receipts Expo, reprises, repli e-mail idempotent, gestion des appareils partagés, récupération après arrêt et cron dédié. 175 tests web réussis, TypeScript réussi, lint sans erreur (4 avertissements existants). Migration additive testée sur PostgreSQL local. Voir `notifications-exploitation.md`. Déploiement, contrôle des appareils et alerte de supervision restent à vérifier ; la case A n'est donc pas encore cochée.
- 3 novembre, reprise locale : guide de démarrage affiché dans un espace neuf (vérifié par les tests navigateur), lien Instagram conservé à l'édition mobile (test unitaire, pas d'essai sur appareil), abonnements relus chez Stripe à chaque événement, avec réconciliation horaire. Écarté : mise à jour du SDK Stripe et rappels de séance ajoutés au repli e-mail, sans lien avec les défauts. Webhook limité aux événements `customer.subscription.*`, seuls configurés. 314 tests unitaires et 34 tests navigateur réussis, 10 ignorés. Déployé le 3 novembre avec `db096e2` : CI réussie, migrations appliquées, tâches planifiées protégées. Aucun vrai paiement ni essai sur appareil pour l'instant, les cases restent donc ouvertes.
