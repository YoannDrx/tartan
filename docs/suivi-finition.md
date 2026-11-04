# Finition de Tartan

Objectif accepté le 3 novembre 2026 : implémenter le plan de l'audit, corriger les défauts et améliorer l'existant jusqu'à une version commercialisable. Référence : `audit-commercialisation-2026-11-03.md`. Les cases ne sont cochées qu'après vérification ; une correction locale n'est pas un déploiement.

## A — Fiabilité

- [ ] Notifications : tentatives persistantes par appareil/canal, erreurs web et Expo, receipts, reprise e-mail, concurrence, échecs visibles.
- [ ] Abonnements : désordre et concurrence des webhooks, synchronisation Stripe, Checkout simultanés, réconciliation.
- [x] Médias Instagram : conservation à l'édition mobile et formulaire cohérent.
- [x] Guide de démarrage : progression réelle du coach, première validation.
- [ ] Suppression et confidentialité : prestataires, cache hors ligne, retrait du consentement, reprise après erreur.

## B — Services

- [ ] Mux : capacité suffisante, coût/quota, upload réel et lecture signée.
- [ ] Isolation production/preview/développement : Blob, base, Mux, Stripe ; secrets et versions d'exécution.
- [ ] Liens universels Apple/Android : configuration réelle et essais après installation.
- [ ] Sauvegarde : restauration actuelle, clé indépendante du Mac, protection/capacité Neon.
- [ ] E-mails, surveillance : réception réelle, alertes de panne, métriques de livraison.

## C — Usage

- [x] Parcours de première séance et invitation guidé.
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

- 4 novembre, exécution du plan V1 (`docs/plan-implementation-v1.pdf`), lots A1 à G9 et section Usage, une PR par lot. Tests : 371 web, 136 mobile, 66 domaine ; Playwright en production locale, 42 réussis et 10 ignorés, plus le test vidéo en mode développement. Cases cochées seulement quand le code suffit à le prouver. Tout le reste attend un paiement, un compte, un vrai téléphone ou le juriste : voir § 7 et § 8 du plan.
  - A : notifications, abonnements, suppression et confidentialité sont codés (C1, C2, C3, E1, F4), mais restent à éprouver en réel (appareils, bac à sable Stripe, effacement chez Mux).
  - B : isolation codée (A2) ; le jeton Blob est encore commun aux trois environnements et `preview.tartan.coach` n'existe pas (T3). Liens : 404 sans configuration (G3), variables à poser (T7, T8). Restauration non rejouée. Surveillance : signal de vie codé (A3), sonde externe à créer (T3).
  - C : aperçu athlète, filtre vidéo par athlète, aide dans les réglages, régularité de l'athlète, actions après validation livrés. Appel à une main et gros caractères : non retouchés, à juger sur téléphone (S15, S16).
  - D, E, F, G : recette terrain, paiement réel, juriste, stores et pilote restent à faire ; le code et les textes sont prêts (G1 à G9).
  - Écarts au plan, assumés : deux adresses de signal de vie au lieu d'une (seuils différents) ; retrait de l'accord vidéo traité par une tâche quotidienne plutôt qu'une date différée dans la file, pour supprimer la ligne et le fichier ensemble ; le préavis d'inactivité ajoute `inactivity_notice_at`.

- 4 novembre : reprise depuis `main` (`2e1f9a1`) et prise en compte de l'audit du 4 novembre. Nouveau lot : retrait effectif des groupes dans le périmètre du coach, nettoyage des attributions à la suppression, exclusion des anciennes séances de groupe avant l'arrivée (jour de Paris), conservation des validations existantes, isolation des tâches horaires et des séances en échec. Reprises des notifications espacées à 15 minutes, décision explicite du fondateur pour limiter les réveils de Neon. Pas de migration de schéma pour ce lot. Les anciennes validations ne sont pas supprimées ou recalculées automatiquement.

- 3 novembre : état de départ revérifié, `514c181`, arbre sans changement fonctionnel. Rapport et reproductions de l'audit conservés. Début de la correction des notifications.
- 3 novembre, lot notifications local : tentatives persistantes, receipts Expo, reprises, repli e-mail idempotent, gestion des appareils partagés, récupération après arrêt et cron dédié. 175 tests web réussis, TypeScript réussi, lint sans erreur (4 avertissements existants). Migration additive testée sur PostgreSQL local. Voir `notifications-exploitation.md`. Déploiement, contrôle des appareils et alerte de supervision restent à vérifier ; la case A n'est donc pas encore cochée.
- 3 novembre, reprise locale : guide de démarrage affiché dans un espace neuf (vérifié par les tests navigateur), lien Instagram conservé à l'édition mobile (test unitaire, pas d'essai sur appareil), abonnements relus chez Stripe à chaque événement, avec réconciliation horaire. Écarté : mise à jour du SDK Stripe et rappels de séance ajoutés au repli e-mail, sans lien avec les défauts. Webhook limité aux événements `customer.subscription.*`, seuls configurés. 314 tests unitaires et 34 tests navigateur réussis, 10 ignorés. Déployé le 3 novembre avec `db096e2` : CI réussie, migrations appliquées, tâches planifiées protégées. Aucun vrai paiement ni essai sur appareil pour l'instant, les cases restent donc ouvertes.
