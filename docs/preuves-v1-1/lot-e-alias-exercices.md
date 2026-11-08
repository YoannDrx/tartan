# Lot E — noms contrôlés des exercices, 8 novembre 2026

État : alias de bibliothèque persistants, éditeurs web/natifs, recherche et projection IA implémentés dans la branche `codex/v1-1-progression`, après `7df9363`. L’IA reste désactivée. La précision sémantique attend la mesure sur corpus et les dictées humaines.

## Comportement

Chaque fiche accepte jusqu’à vingt autres noms de 120 caractères, renseignés par le coach. Le serveur normalise les espaces et déduplique les équivalents typographiques (casse, accents, apostrophes). Il ne fabrique pas de synonymes et ne fusionne aucune fiche. Les anciennes apps qui omettent le champ conservent ses valeurs ; une liste vide signifie un effacement explicite. Les droits d’édition de la bibliothèque restent identiques et une fiche étrangère n’est pas modifiable.

Les éditeurs web et natif affichent le champ, ses limites et la distinction entre synonyme et variante. La recherche manuelle retrouve aussi les alias, sans sélectionner un exercice automatiquement. Neuf fiches de la bibliothèque initiale disposent de synonymes explicites dans le code, dont Back squat, Front squat et RDL. Ils sont copiés uniquement lors de la création de nouvelles fiches. Les fiches existantes gardent une liste vide jusqu’à une saisie explicite : aucun rapprochement historique par ressemblance de nom.

Le contexte privé de la proposition conserve la version et les alias autorisés. Un changement de fiche, y compris d’alias, invalide sa revue au même titre que les autres modifications. Les propositions anciennes sans ce champ restent lisibles. La projection prestataire expose uniquement noms, alias, catégorie et jetons autorisés ; aucune référence individuelle de force n’est ajoutée.

Les collisions nom/alias non résolues repérées dans les consignes sont transmises avec l’ensemble de leurs jetons, sans départage par ordre. Les correctifs et limites mesurées ensuite sont détaillés dans [la preuve du corpus](lot-e-corpus-ia.md). Un contrôle local supplémentaire remplace une proposition par une question si la citation utilise un alias partagé sans nom explicite permettant de distinguer l’exercice sélectionné. La question ne génère aucun nouvel appel modèle et ne crée aucune séance. Les occurrences longues priment sur leurs sous-termes : Front squat n’est pas ramené au terme partagé squat. Les réponses de clarification peuvent fournir le nom complet. Ce contrôle lexical ne prétend pas comprendre toute négation ou le sens d’une consigne ; cette partie doit être éprouvée sur corpus.

## Migration et compatibilité

Migration additive `20261108100000_exercise_aliases` : colonne `exercises.aliases TEXT[] NOT NULL`, vide par défaut. Pas de suppression, de réattribution de maximum ou de modification de prescription historique.

- Base vierge : les tests serveur appliquent les 37 migrations.
- Ancien schéma : 36 migrations appliquées, fiche synthétique insérée, puis migration en **0,017 s** ; nom et fiche conservés, zéro alias inventé.
- Base locale du simulateur : migration appliquée, données conservées.
- Preview Neon `br-floral-sun-b9iar8ge` : **36 → 37 migrations en 3,92 s**. Lecture et écriture de la colonne par `tartan_preview_app` vérifiées ; zéro compte et aucun drapeau activé.
- Production : aucune migration de ce lot appliquée.

## Vérifications

**682 tests serveur** réussis dans 70 fichiers en 71,55 s avant le contrôle lexical final ; après cet ajout, **32 tests ciblés** de service, prestataire et propositions réussis en 6,49 s. Cinq tests domaine couvrent bibliothèque et collisions lexicales. Huit tests du formulaire mobile passent, dont conservation, effacement et limites des alias. Types monorepo réussis.

Deux parcours navigateur desktop/mobile réussis en **41,2 s** : création avec alias, déduplication, recherche par synonyme, réouverture, refus d’une saisie trop longue sans modification, puis effacement explicite. Axe et débordement vérifiés dans le formulaire. Cette recette utilise le serveur de développement pour laisser le serveur du simulateur ouvert ; la CI exécute les parcours sur le build de production.

Aucun appel OpenAI réel effectué pour ce lot. La migration et les tests de requêtes simulées ne prouvent pas le seuil de rattachement du corpus. La recette native physique, les trente dictées réelles/scénarisées, les corrections mesurées avec les coachs et l’évaluation complète restent à réaliser.
