# Calculateur de charges — 8 novembre 2026

Développé depuis `68ef5b3`. Écran web et natif, accessible depuis Exercices, la fiche athlète et Progrès lorsque le suivi détaillé est activé. Calcul entièrement local, sans enregistrement d’un test ni modification d’une référence de force.

Une seule formule, Epley pour 2–10 répétitions ; une répétition conserve la charge et porte un libellé distinct. Au-delà de dix, aucune estimation. Saisie des décimales françaises, refus des valeurs tronquées ou hors bornes. L’estimation et la référence du tableau restent indépendantes jusqu’au bouton « Utiliser dans le tableau » ; le transfert utilise l’estimation affichée à deux décimales. Tableau 40–100 % par pas de 5 %, valeurs exactes affichées jusqu’à quatre décimales et valeurs arrondies séparées. Pas par défaut 1,25 kg ; composant capable de recevoir le pas d’un exercice, raccordement à la fiche d’historique encore à faire.

## Design et validation

UI/UX Pro Max : libellés, retour immédiat, tableau accessible et choix explicite. Frontend Design : deux sections d’une même feuille, Barlow et chiffres tabulaires, alignement des valeurs, palette claire du bureau Tartan et aucune animation. La revue visuelle a découvert que `/outils/charges` héritait du monde rouge d’accueil : chemin ajouté au bureau clair, puis capture et parcours revérifiés. Impeccable : zéro travers. Revue React : calcul dérivé sans effet ni état redondant, aucun appel réseau ou persistance, composants distincts, tableaux typés.

- **110 tests domaine** ; **523 tests serveur** sur la suite complète incluant l’historique et la bibliothèque.
- Types monorepo et lint sans erreur (quatre avertissements existants) ; exports Hermes iOS et Android réussis.
- Parcours navigateur de production desktop/mobile : drapeau désactivé, accès depuis la bibliothèque, 60,5 kg × 3 → 66,55 kg, référence 87 conservée avant choix, valeurs exactes/arrondies, refus de 11 répétitions, mesure à une répétition, aucune référence créée en base. Axe à taille normale et zoom 200 %, 390/768/1440 px sans débordement. Non-régressions onboarding/profil et déplacement/version du constructeur couvertes dans la même passe.
- Simulateur iPhone 17 Pro iOS 26.3 : connexion, bibliothèque, calculateur. 60,5 × 3 → 66,55 ; référence 87 → 34,8 exact et 35 arrondi à 40 % ; choix explicite → référence 66,55 ; 11 répétitions affiche l’erreur, désactive le bouton et conserve le tableau. Rechargement explicite du client Expo avant la recette. Aucun téléphone physique ni VoiceOver/TalkBack revendiqué.

Le premier parcours navigateur a échoué avant le calculateur : le helper de création cherchait « Premier groupe » sans correspondance exacte, désormais ambigu avec « Objectif du premier groupe ». Sélecteur rendu exact, puis parcours rejoués avec succès. La recette native utilisait API locale 3102, Metro 8083 et base synthétique ; le serveur 3102 lancé pour ce lot a été arrêté, sans toucher au port 3000.

[Desktop](images/calculator-desktop.png) · [Mobile](images/calculator-mobile.png)

Le calculateur est implémenté ; les écrans d’historique/courbes, le raccordement à la référence de chaque exercice et la célébration de records restent à terminer. Pas de déploiement en production ni d’activation de drapeau.
