# Lot E — matériel des exercices et noms lisibles

Preuve locale du 8 novembre 2026, sur la branche de PR #45. Ce lot ne valide pas la bêta IA et n'active aucun espace.

## Changements

La projection autorisée transmet la classification sportive (mouvement, matériel) et la convention de charge de la fiche. Le schéma du prestataire refuse les champs supplémentaires, y compris les notes privées imbriquées, ainsi que les valeurs de matériel ou de convention inconnues. Aucun maximum individuel n'est transmis. Les anciennes propositions dépourvues de ces métadonnées restent lisibles et transmettent `null`, sans inférence rétroactive depuis une fiche actuelle. Aucun changement du schéma SQL.

L'adaptateur explique explicitement la distinction entre barre libre, machines, charge additionnelle, assistance et poids du corps. Une variante de matériel absente ou incompatible doit donner lieu à une question. Cette consigne n'est pas présentée comme une garantie déterministe : les deux essais réels du cas guidé réussissent, mais l'évaluation complète reste insuffisante.

Web et natif résolvent localement les jetons connus dans les questions, options, échanges, citations et textes de présentation. La réponse choisie est relue avec les noms, puis le service pseudonymise de nouveau avant tout appel. Le remplacement utilise uniquement le contexte déjà autorisé ; aucun nom extérieur n'est recherché, aucune substitution récursive ni troncature. Les champs techniques de destinataire et d'exercice restent inchangés.

La résolution des titres et notes copiés dans les brouillons enregistrables reste à terminer séparément, avec traitement explicite des limites de longueur. Le présent correctif couvre la lecture de la proposition et le parcours de clarification.

## Vérifications

- 38 tests serveur ciblés réussis (prestataire, propositions, évaluateur), en 3,33 s : projection, rejet des métadonnées privées, compatibilité des anciennes propositions, droits et versions.
- Trois tests de résolution locale réussis : jetons distincts, limites de mots, contexte absent, libellés longs et absence de substitution récursive.
- Types du monorepo, lint ciblé web et `design:check` réussis.
- Deux parcours Playwright desktop/web mobile réussis en 40,8 s sur serveur de développement et base locale jetable dédiée. Noms dans la question et le champ de réponse après rechargement, aperçu de charge, correction, réponse de confirmation perdue, récupération d'un seul brouillon non publié, Axe et absence de débordement. Aucun appel OpenAI pendant ces parcours.
- Premier lancement arrêté par l'absence de la base dédiée ; base créée explicitement. Premier passage fonctionnel échouait sur une assertion ajoutée deux fois, dont une après création où les questions ne sont plus affichées ; assertion déplacée uniquement à l'étape de clarification, puis deux passages réussis.
- Évaluation réelle : 60 cas par modèle, résultats et empreintes dans [le rapport du corpus](lot-e-corpus-ia.md). Modèle initial 52/60, alternatif 49/60 ; aucun modèle ni drapeau modifié en production.

Les noms du natif sont typés et partagent les règles testées, mais cette modification n'a pas de preuve visuelle native ni d'essai physique. Le simulateur iPhone 17 Pro et TartanDev sont toujours démarrés au dernier contrôle. Les essais humains, trente enregistrements, fidélité sémantique, bêta coach et autres critères commerciaux restent ouverts.
