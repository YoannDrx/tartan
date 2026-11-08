# Lot E — lecture compacte des charges individuelles

Preuve locale du 8 novembre 2026, après `5aba4bf`, sur la branche de PR #45.

## Changement d'expérience

L'aperçu web et natif présente une liste d'athlètes plutôt que dix détails ouverts simultanément. Chaque ligne indique les exercices, les pourcentages sans référence disponible et les adaptations de charge de l'athlète. Les comptes portent uniquement sur les items de cette page ; une prescription sans charge ou zéro kilogramme n'est pas une conversion manquante. Aucune somme de kilogrammes hétérogènes ni appréciation automatique de la programmation.

Un seul athlète est développé à la fois. Ses prescriptions, références datées, adaptation et retour à la charge commune restent disponibles. La pagination referme le détail ; une adaptation conserve l'athlète ouvert après rafraîchissement. Sur le natif, la pagination revient au début si la séance change, et la disponibilité de la confirmation est liée au contenu exact de l'aperçu, comme sur le web : une ancienne réponse ne valide pas une séance modifiée.

Le nom accessible des boutons web vient du texte visible, avec un espace explicite entre nom et résumé. L'état développé est exposé sur les deux plateformes. Séparateurs fins, sans cartes imbriquées, mêmes tokens et cibles tactiles. Aucun accès, calcul serveur, quota ou drapeau d'activation modifié.

## Vérifications

- Trois tests métier réussis : pourcentage sans référence, zéro kilogramme, poids du corps/charge absente, adaptations limitées à l'athlète et aux items visibles, suppression du manque après résolution.
- Deux parcours Playwright desktop/web mobile réussis en **44,6 s**, sur serveur de développement et base locale jetable. Dix lignes repliées, absence de boutons d'adaptation cachés dans l'arbre, résumé accessible, ouverture au clavier, une seule ligne développée, pagination, adaptation et détail conservé, relecture invalidée, confirmation perdue et un seul brouillon non publié.
- Contrôles à **390, 768 et 1440 px** : aucun débordement horizontal et liste de dix lignes de moins de 1 300 px de haut. Ces mesures portent sur les douze athlètes fictifs de ce scénario, pas sur tous les noms possibles.
- Axe passe après correction du décalage initial entre texte visible et nom accessible. Deux passages initiaux avaient échoué sur cette règle ; elle n'a pas été désactivée.
- Types du monorepo puis natifs après liaison de la relecture au contenu exact ; lint ciblé, contrôle design et exports Hermes iOS/Android réussis. Impeccable n'a trouvé aucun motif sur les deux fichiers TSX, mais son analyse était limitée aux expressions régulières ; ce résultat ne vaut pas audit complet du rendu.
- Capture compacte mobile inspectée. [Mobile](images/planner-charges-compactes-mobile.png) · [Desktop](images/planner-charges-compactes-desktop.png).

La tentative de recette visuelle iOS a confirmé le verrouillage du Mac. Aucun parcours natif visuel, VoiceOver/TalkBack, zoom 200 % ou téléphone physique n'est déclaré validé par ce lot. Les deux skills UI/UX Pro Max et Frontend Design restent absents des répertoires de skills disponibles ; la passe suit `DESIGN.md`, les contrôles navigateur et Impeccable, sans revendiquer leur exécution.

L'IA demeure désactivée. La fidélité du corpus, les dictées enregistrées, la landing et les autres jalons du [suivi de livraison](../livraison-v1-1.md) restent ouverts.
