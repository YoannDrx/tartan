# Préparer une série d’illustrations

Retrouver la clé et la version de la fiche dans l’atelier des exercices. Pour chaque image, choisir la phase à illustrer et comparer les appuis, la trajectoire et le matériel au texte. Préparer un PNG carré cadré pour le téléphone. Le fichier porte la clé puis la version de l’image, par exemple `snap-down-v2.png`.

Renseigner la clé, la version du guide, la version de l’image et son texte alternatif dans `apps/web/src/server/catalog-illustrations.ts`. Pour corriger une image déjà enregistrée, augmenter sa version. Depuis la racine du dépôt, avec `cwebp` disponible, passer les PNG d’une même série à la commande.

```sh
corepack pnpm --filter @tartan/web catalog:images /chemin/vers/snap-down-v2.png
corepack pnpm --filter @tartan/web catalog:images --check
```

L’import prépare le WebP de fiche à 488 px et sa vignette à 168 px, retire les métadonnées et actualise les ressources embarquées sur iOS et Android. Les fichiers d’une ancienne version restent disponibles aux séances hors ligne. Une seconde exécution avec la même image vérifie les fichiers existants. Un contenu différent exige une nouvelle version.

Relire la nouvelle version dans `/admin/exercices#atelier` au format téléphone. Le texte, l’image et le geste disposent chacun de leur validation. Une nouvelle version de l’image doit recevoir sa propre validation avant affichage aux athlètes.

## Série produite le 25 novembre 2026

Les 233 fiches versionnées sont illustrées. Les 24 fiches vidéo historiques sont identifiées par les UUID stables de la migration de bibliothèque commune. Leur couverture figure dans `apps/web/src/server/legacy-catalog-covers.ts` et suit sa propre décision de relecture. Pour une routine, l’image montre sa préparation ou un mouvement effectivement décrit. Les vidéos d’origine restent accessibles.

Les 254 images de fiche distinctes occupent 4 326 160 octets. Avec les vignettes, le poids est de 5 276 234 octets. Les budgets de génération du pilote reposaient sur six générations pour quatre visuels. Le générateur intégré ne fournit pas de coût monétaire par image. Dans la série suivante, cinq images ont été reprises au contrôle visuel. Le fondateur a validé les douze images du pilote, puis toutes les familles et les 24 couvertures historiques. Le sélecteur de média présente le geste animé Tartan en premier, l’image fixe ensuite, puis la vidéo lorsqu’elle existe.
