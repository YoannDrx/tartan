# Préparer une série d’illustrations

Retrouver la clé et la version de la fiche dans l’atelier des exercices. Pour chaque image, choisir la phase à illustrer et comparer les appuis, la trajectoire et le matériel au texte. Préparer un PNG carré cadré pour le téléphone. Le fichier porte la clé puis la version de l’image, par exemple `snap-down-v2.png`.

Renseigner la clé, la version du guide, la version de l’image et son texte alternatif dans `apps/web/src/server/catalog-illustrations.ts`. Pour corriger une image déjà enregistrée, augmenter sa version. Depuis la racine du dépôt, avec `cwebp` disponible, passer les PNG d’une même série à la commande.

```sh
corepack pnpm --filter @tartan/web catalog:images /chemin/vers/snap-down-v2.png
corepack pnpm --filter @tartan/web catalog:images --check
```

L’import prépare le WebP de fiche à 488 px et sa vignette à 168 px, retire les métadonnées et actualise les ressources embarquées sur iOS et Android. Les fichiers d’une ancienne version restent disponibles aux séances hors ligne. Une seconde exécution avec la même image vérifie les fichiers existants. Un contenu différent exige une nouvelle version.

Relire la nouvelle version dans `/admin/exercices#atelier` au format téléphone. Le texte, l’image et le geste disposent chacun de leur validation. Une nouvelle version de l’image doit recevoir sa propre validation avant affichage aux athlètes.

## Estimer la série avant production

Au 25 novembre 2026, les 22 fiches préparées occupent 390 138 octets avec leurs vignettes web, dont 321 042 octets pour les images de fiche embarquées sur chaque plateforme native. Au même poids moyen, les 233 fiches représenteraient environ 3,94 Mio sur le web et 3,24 Mio dans chaque application native.

Pour les quatre dernières fiches, six générations ont été nécessaires. Le franchissement en hauteur a demandé deux reprises. Si ce taux se maintient, les 211 fiches restantes représenteraient environ 317 générations. Cette extrapolation provient d’une petite série. La facture du générateur intégré ne donne pas de prix par image dans l’atelier. Pour convertir la projection en budget, multiplier 317 par le coût effectif d’une génération, puis ajouter le temps de relecture sportive. Les images ne paraissent dans la bibliothèque des athlètes qu’après validation dans l’atelier.
