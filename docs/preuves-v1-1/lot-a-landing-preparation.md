# Lot A — accueil préparation physique athlé

8 novembre 2026. Branche `codex/v1-1-progression`, après `f2eb95a`. Environnement local isolé, données fictives ; aucune modification ni activation en production.

## Résultat

La page présente désormais Tartan comme un outil de préparation physique pour l’athlétisme. Force, vitesse, puissance, endurance et mobilité partagent le premier écran. Le film de hauteur n’est plus le récit d’entrée : le parcours suit « préparer → individualiser → réaliser → progresser » avec des ancres accessibles, un calendrier réellement capturé et les démonstrations interactives existantes d’appel et de validation.

La vidéo est présentée comme analyse technique d’une course, d’un exercice de force ou d’un saut. Le schéma de saut image par image reste accessible dans un volet explicitement intitulé « Essayer un exemple en saut en hauteur ». Il n’est pas présenté comme une vraie vidéo d’utilisateur.

La partie progression porte un avertissement visible : nouveautés V1.1 en préparation pour le pilote, pas encore ouvertes à tous les espaces. Elle ne promet ni IA disponible ni publication dans les stores. Les offres restent dérivées des constantes du domaine et l’action d’inscription respecte `COACH_SIGNUP_MODE`.

La mise en page reste rendue côté serveur, avec les composants interactifs existants. Aucun nouveau prestataire, traqueur, appel IA, schéma ni chargement de données personnelles. Les textes et la description SEO sont dans `packages/i18n`.

## Provenance des captures publiques

- `apps/web/src/features/landing/images/calendrier.png` : capture du vrai calendrier local à 1440 × 900, depuis `e2e/workspace-theme.spec.ts`. Espace et groupe fictifs ; cinq séances publiées par l’API, réparties dans la semaine, exercices de leur catégorie. Le test conserve ses contrôles à 30, 60 et 120 athlètes. L’indicateur de développement Next est masqué uniquement pendant la capture ; aucun élément produit ni contenu n’est retouché.
- `apps/web/src/features/landing/images/analyse-v1-1.png` : copie exacte de `docs/preuves-v1-1/images/analysis-desktop.png`, issue du parcours `e2e/training-analysis.spec.ts`. Données synthétiques du scénario documenté dans les preuves d’analyse. Aucune donnée de santé ni donnée réelle d’athlète dans cette capture. La légende indique qu’il s’agit de la version en cours de validation.
- Les images sont importées statiquement : dimensions déduites du fichier et URL contenant son empreinte, pour ne pas réutiliser une ancienne capture du cache d’optimisation après un remplacement.
- Les images s’ouvrent à taille originale via un lien. Les descriptions alternatives et le texte adjacent expliquent leur contenu sans exiger la lecture des petits caractères de la capture.

## Vérification

- Parcours interactif et bureau : **quatre tests desktop/web mobile réussis en 1,3 minute** après correction de deux erreurs du harnais (import i18n oublié et correspondance `running`/`running_drill`). Aucun assouplissement d’assertion produit.
- Recapture finale du calendrier : **un test desktop réussi en 36,7 s**, dont les jeux de 30/60/120 athlètes, Axe et absence de défilement horizontal.
- Vérification finale de l’accueil, de la déconnexion, du retour après suppression et des pages publiques : **six tests réussis en 44,8 s**, deux scénarios réservés au desktop ignorés sur mobile comme dans le harnais existant ; **deux parcours desktop/mobile supplémentaires réussis en 12,7 s** après passage aux imports statiques et vérification du chargement des images.
- Contrôles : ancres, disponibilité V1.1 visible, chargement effectif des images, 390/768/1440 px, zoom CSS 200 %, appel, validation, réinitialisation, schéma vidéo et navigation vers l’inscription. Les pages publiques passent Axe sans exception ajoutée.
- Types monorepo réussis ; vérification web après imports statiques également réussie. Lint ciblé réussi. `design:check` : zéro travers. Impeccable CLI : aucun signalement sur ce fichier TSX par analyse regex ; les règles de page rendue ne sont pas exécutées par cette passe.
- Revue React : page serveur, aucune nouvelle gestion d’état ni effet, images avec dimensions et variantes de taille, liens explicites et volet natif `details`.

Captures de la page relue : [mobile](images/landing-preparation-mobile.png) et [desktop](images/landing-preparation-desktop.png).

## Limites

Tests sur Next en développement et navigateurs automatisés Chromium, pas sur iPhone/Android physiques. Le zoom CSS ne remplace pas une recette de zoom navigateur et lecteur d’écran. Les captures ne constituent ni des témoignages clients ni une preuve de bénéfice sportif. Les fichiers SKILL.md UI/UX Pro Max et Frontend Design n’ont pas été trouvés dans les catalogues et emplacements locaux recherchés : leurs passes ne sont pas déclarées effectuées. La recette physique, la revue avec les coachs et les médias licites de bibliothèque restent ouvertes.

Les légendes de disponibilité devront être actualisées au moment de l’ouverture effective de progression/phases, avec des captures du commit alors publié. Aucun changement de flag n’est inclus ici.
