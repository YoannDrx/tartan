# Lot E — titres et consignes des brouillons sans troncature

Preuve locale du 8 novembre 2026, après `5ad01fd`, sur la branche de PR #45.

## Comportement

La préparation des brouillons remplace les jetons connus dans les titres, noms de blocs et notes de prescription par les noms du contexte autorisé. Le remplacement se fait côté serveur après recontrôle des droits et versions, sans nouvel appel IA ni nouvelle écriture de séance. Les identifiants techniques, prescriptions et adaptations ne sont pas modifiés par cette présentation.

Une expansion peut dépasser les limites d'une séance (titre 120, bloc 80, consigne 500 caractères). La réponse de **relecture**, distincte du contrat d'écriture, accepte alors le texte développé entier, avec une borne de transport de 24 000 caractères par champ. Le coach peut corriger ces champs sur web et natif. Les indications montrent la longueur et la limite ; aucune portion de consigne n'est retirée automatiquement.

L'aperçu de charge ne part pas tant que le brouillon est invalide. La confirmation garde les limites strictes existantes, côté interface et serveur. Une correction retire l'accord de relecture et invalide l'ancien aperçu. Aucun assouplissement des écritures de séance ou du contrat du prestataire. Aucune migration, activation ni modification du modèle.

Les anciens clients utilisant le contrat strict de réponse peuvent refuser l'affichage d'un brouillon développé trop long ; ils ne peuvent pas l'enregistrer silencieusement. Le planificateur n'est pas activé publiquement et les applications du lot doivent être livrées ensemble pour ce parcours.

## Preuves

- **26 tests serveur/API**, en 6,40 s : préparation entière, contrat de transport, refus d'aperçu/confirmation avant correction, zéro séance créée sur refus, confirmation après correction et une seule génération.
- **18 tests domaine**, dont les règles du planificateur et la substitution locale.
- **11 tests de formulaire natif** : une note trop longue reste entière, est refusée à l'application, puis acceptée après correction explicite sans perte des séries/répétitions.
- **Deux parcours Playwright desktop/web mobile**, en 44,9 s, sur base locale jetable et serveur de développement : développement de dix noms de groupe dans le titre, six noms d'exercice dans le bloc et quarante dans la note ; contenu entier visible et corrigeable, aperçu initialement désactivé, adaptation de charge, relecture invalidée, perte de réponse de confirmation et récupération d'un seul brouillon non publié. Les valeurs corrigées sont relues via l'API. Axe et absence de débordement passent.
- Types monorepo, lint ciblé, design sans travers ; exports Hermes iOS et Android réussis. Le contrôle des types a été relancé après Playwright : un lancement simultané avait rencontré la suppression/recréation des types `.next/dev` par le serveur de développement.
- Capture web mobile finale inspectée. La revue reste longue avec dix athlètes ouverts : une présentation plus compacte des charges individuelles reste un chantier UX. Les exports ne constituent ni une recette native visuelle ni une publication store.

Aucun appel prestataire réel nécessaire pour ce correctif. Les défauts de fidélité du corpus, trente enregistrements et essais physiques restent ouverts : [état du corpus](lot-e-corpus-ia.md).
