# Références de force par exercice

La progression V1.1 lie un test à l’identifiant de l’exercice et conserve sa convention de charge. Une référence de travail est choisie explicitement par le coach : maximum testé, maximum estimé depuis un test ou valeur de travail choisie. Ajouter un test plus récent ne remplace pas cette référence.

## Activation et compatibilité

La migration `20261107210000_exercise_strength_references` est additive. Les anciens tests gardent `exercise_key`, leur valeur, leur type et leur date ; `exercise_id` reste vide jusqu’à un rapprochement confirmé. Aucun nom d’exercice n’est interprété automatiquement. Le drapeau `progression_enabled` contrôle les nouvelles écritures de référence et de rapprochement. La saisie historique sans identifiant d’exercice reste acceptée.

Dans la bibliothèque, préciser la convention : charge externe totale, charge ajoutée au poids du corps, assistance ou poids du corps. Seules les deux premières peuvent recevoir une référence de force. Les variantes libres, machines et assistées gardent des fiches distinctes. Le pas d’arrondi est propre à l’exercice, avec 1,25 kg par défaut. Une convention déjà utilisée par des tests, références ou séries ne peut pas être changée ; créer une variante.

Le constructeur propose la référence liée à l’exercice. Une clé liée à un autre exercice est refusée, y compris dans une adaptation individuelle. Les anciennes clés non rapprochées restent compatibles avec les séances existantes. Une référence manquante produit une charge non calculable, jamais une valeur inventée.

## Rapprochement des anciennes clés

Opération réservée au propriétaire de l’espace, après vérification de la technique et de la convention de chaque fiche. Les huit clés reconnues sont `back_squat`, `front_squat`, `clean`, `snatch`, `deadlift`, `hip_thrust`, `bench_press`, `pull_up`. Une clé inconnue reste dans le rapport sans attribution automatique.

1. Lire `GET /api/v1/orgs/{orgId}/strength-mappings`. Le résultat distingue les clés encore non liées et les correspondances déjà confirmées.
2. Vérifier la fiche exacte et sa convention. Si l’ancien test ne permet pas de distinguer deux variantes, conserver le résultat non lié jusqu’à clarification.
3. Envoyer `POST` sur la même route avec `legacyKey`, `exerciseId`, `confirmed: true` et un `reason` explicite de 10 à 500 caractères. Le motif doit décrire la vérification technique, sans information de santé.
4. Relire le rapport. Le rapprochement est idempotent ; les futures saisies d’un ancien client avec cette clé sont liées à cette fiche. Deux confirmations concurrentes de variantes différentes ne peuvent pas réussir.
5. Choisir ensuite la référence pour chaque athlète. Le rapprochement seul ne sélectionne pas automatiquement un ancien maximum. Jusqu’à ce choix, une ancienne prescription utilisant cette clé n’a pas de charge calculable. Organiser le rapprochement et les choix de références dans la même recette avant activation pour les utilisateurs.

Une correspondance confirmée ne peut pas être réattribuée silencieusement. Le journal d’audit enregistre l’opération, son auteur et son espace, sans valeur de force ni données de santé. Depuis le lot `7519866`, le propriétaire dispose de ce parcours dans les réglages web (`/reglages/references-force`) et natifs. Il exige une fiche choisie explicitement, un motif, une vérification cochée et une confirmation récapitulative. Les clés inconnues restent visibles sans action. Voir `docs/preuves-v1-1/lot-b-rapprochement-force.md` pour les preuves et limites.

## API commune web et applications natives

- `POST /api/v1/orgs/{orgId}/athletes/{athleteId}/strength-tests` : ajout de test ; `exerciseId` pour le lien, `selectAsReference` uniquement sur demande explicite.
- `GET /api/v1/orgs/{orgId}/athletes/{athleteId}/strength/{exerciseId}` : référence et tests liés de l’athlète autorisé.
- `PUT` sur la même route : `{ source: "test", testId }` ou `{ source: "working", valueKg }`.

Ces opérations contrôlent l’espace, le rôle et le groupe. Les athlètes peuvent lire leurs propres données, pas choisir la référence du coach. Un test appartenant à un autre athlète, exercice ou espace ne peut pas être sélectionné.

Supprimer le test source retire la référence actuelle qui en dépend ; aucun autre test n’est choisi automatiquement. Une référence manuelle n’est pas affectée par la suppression d’un test indépendant. Les réalisations détaillées déjà enregistrées conservent la copie de la référence utilisée, même après correction de la série ou suppression du test source.

## Limites de ce lot

Le gel dès publication est désormais implémenté pour les séances avec progression activée ; voir [prescriptions-figees.md](prescriptions-figees.md) pour les révisions et les anciennes séances. Le choix de référence est utilisable sur le web et les applications natives depuis `9ad481b`. Les formulaires natifs permettent aussi d’ajouter les tests et de préciser la convention et le pas de charge des exercices. Leur recette sur téléphone physique reste à réaliser. L’historique complet des séries, les courbes et les records ne sont pas terminés par ce lot.
