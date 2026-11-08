# Répartition des mouvements et du matériel

8 novembre 2026, depuis `c8fe58d`, PR #45 en brouillon. Aucun changement de production ni activation des fonctions.

## Comportement livré

Le coach peut choisir un mouvement principal et plusieurs matériels dans la fiche exercice, sur web et natif. Ces choix sont facultatifs et distincts des catégories et étiquettes existantes. « Non renseigné » conserve une absence d’information ; « Sans matériel » correspond à une liste explicitement vide. Le corps libre n’est pas converti en charge externe.

Les 49 fiches initiales ont un classement explicite, copié uniquement à la création d’un espace ou des données de démonstration. Les fiches et copies historiques existantes ne sont pas rapprochées par nom. Une correction de fiche ne modifie pas les prescriptions déjà publiées.

L’analyse présente, par mouvement et par matériel, les occurrences par athlète, les séries prescrites renseignées et les séries de travail effectivement enregistrées. Un échauffement, une série non faite ou une validation simple sans détail ne devient pas une série réalisée. La couverture distingue classement inconnu et nombre de séries non renseigné. Un exercice peut figurer dans plusieurs lignes de matériel ; l’interface explique que ces lignes ne s’additionnent pas. Aucune appréciation automatique de variété suffisante ni risque de blessure.

La logique pure est partagée dans `packages/domain`, les contrats dans `packages/contracts`, les droits dans les services existants. Les anciens clients omettant le nouveau champ conservent son contenu. Un classement explicitement remis à null reste autorisé. La bibliothèque commune et les exercices d’un autre espace restent non modifiables.

## Migration

Migration additive `20261108060000_exercise_classification` : colonne JSONB nullable, sans réécriture de données ni reprise par nom. Les nouveaux champs de copie et de réponse sont facultatifs pour les anciennes données et applications.

- Base vierge : les suites de tests appliquent les 33 migrations.
- Schéma ancien synthétique à 32 migrations : ajout en **0,024 s**, ancienne fiche conservée sans classement et insertion au format ancien toujours possible. Le premier contrôle du harnais comptait aussi les exercices communs historiques ; le contrôle corrigé cible les deux identifiants synthétiques et réussit. Bases temporaires supprimées.
- Preview Neon isolée `br-floral-sun-b9iar8ge` : **32 → 33 migrations en 2,64 s**, zéro compte, drapeaux désactivés. Connexion, rôle propriétaire et hôte vérifiés avant exécution. Aucun secret dans les sorties. Production toujours hors de cette migration.

## Vérification

- **580 tests serveur réussis**, 59 fichiers, 52,46 s, dont compatibilité ancien client, gel après publication, null explicite, refus inter-espace et codes invalides.
- **15 tests domaine ciblés réussis**, bibliothèque et analyses ; **7 tests de formulaire natif réussis**.
- Types monorepo réussis ; lint sans erreur avec quatre avertissements préexistants ; contrôle de design sans travers.
- Exports Hermes iOS/Android réussis. Ils ne constituent pas des builds signés ni une recette physique.
- Recette navigateur de production : saisie du classement dans le véritable éditeur, lecture par le client API natif, publication, analyse de quatre occurrences / douze séries prévues / six réalisées, contrôles Axe, débordements et zoom. **Deux parcours réussis en 28,5 s** après compactage. [Éditeur mobile](images/classification-editor-mobile.png), [éditeur desktop](images/classification-editor-desktop.png), [analyse mobile](images/classification-analysis-mobile.png), [analyse desktop](images/classification-analysis-desktop.png).

Relecture selon DESIGN.md et les recommandations React : options repliées, libellés permanents, contrôles natifs accessibles, cibles tactiles de 44 px, matériel sur deux colonnes web, couleurs existantes. Les entrées de skills UI/UX Pro Max et Frontend Design ne sont pas disponibles dans les répertoires locaux vérifiés ; aucune nouvelle exécution de ces deux skills n’est revendiquée. Le contrôle Impeccable du dépôt, les captures et Axe sont distincts de ces passes. VoiceOver/TalkBack et appareils physiques restent à éprouver.

Le lot D reste ouvert pour les intensités homogènes et la recette globale. Le planificateur IA, la fin du lot A, les services externes, le juridique et les stores restent dans le périmètre à terminer avant les jalons correspondants.
