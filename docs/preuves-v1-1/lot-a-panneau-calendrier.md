# Lot A — détail de séance depuis le calendrier

8 novembre 2026, après `c733f1b`, branche `codex/v1-1-progression`.

## Comportement

Depuis le calendrier, le détail de séance s’ouvre à droite sur ordinateur. Sur un écran inférieur à 1024 px, il occupe tout l’écran, avec les marges de sécurité du téléphone. Le calendrier et sa période restent derrière le panneau ; l’action Fermer et Échap reviennent à la navigation précédente. Un clic accidentel sur le fond ne ferme pas l’appel en cours de saisie.

Le bouton Précédent du navigateur ferme le panneau et Suivant peut le rouvrir. Son adresse de calendrier porte le paramètre `seance`, avec le groupe et la période. Recharger cette adresse conserve le panneau ; Fermer revient au calendrier même sans navigation préalable. Le lien « Ouvrir la page de la séance » donne accès à la page autonome, avec son retour au calendrier filtré. Les adresses historiques `/seances/:id/suivi` ne changent pas.

Le contenu est extrait de la page existante, sans duplication des règles métier : mêmes services serveur, rôles, filtres d’athlètes et contrôle des consentements. Le mode compact empile les retours, l’appel et les échanges. Aucun nouveau endpoint ni modèle de données.

## Architecture

Le calendrier rend son contenu et, lorsqu’une séance est sélectionnée, le détail serveur dans un panneau Radix. L’appel et ses actualisations conservent ainsi la période affichée. Le thème de travail est appliqué explicitement au portail pour conserver titres compacts et couleurs. Les services existants contrôlent les droits de lecture et d’écriture. Aucun routage intercepté ni duplication de l’API.

Le build Playwright de production utilise `.next-e2e`, répertoire ignoré par Git et ESLint, pour préserver le build `.next` d’un serveur local déjà lancé. Le choix reste limité au processus de recette (`TARTAN_E2E_BUILD`).

## Recette

- **Deux parcours sur build de production réussis en 46,6 s**, Chromium desktop 1280 × 800 et Pixel 7 émulé, base jetable `tartan_planner_metadata_e2e`. Le serveur de recette utilise le port 3100 ; le serveur natif 3102 reste indépendant.
- Dimensions du panneau, ouverture au clavier, appel enregistré puis relu via l’API, calendrier toujours présent après actualisation, fermeture par Échap, retour du focus, historique Précédent/Suivant, modification, rechargement de l’adresse du panneau, fermeture sans historique initial et ouverture de la page autonome vérifiés.
- Axe et absence de débordement horizontal passent ; captures desktop et mobile relues. Le parcours couvre aussi création, publication et conservation du groupe, semaine/mois et date initiale.
- **Quatre tests unitaires** de navigation réussis : contexte filtré, destinations non autorisées écartées, ancienne sélection retirée au retour, ancre et date conservées.
- Lint web : zéro erreur, quatre avertissements de navigation préexistants. `design:check` : zéro travers. Types web indépendants réussis. Impeccable sur les deux composants TSX : analyse regex uniquement ; les contrôles de page rendue viennent d’Axe et de la relecture des captures.

Captures fictives : [desktop](panneau-calendrier-desktop.png), [mobile](panneau-calendrier-mobile.png). Les messages temporaires de confirmation sont visibles ; aucun e-mail ou push réel n’est envoyé par la recette.

## Limites

Ce lot concerne le web. Les écrans natifs et les appareils physiques ont leur recette distincte. VoiceOver/TalkBack et les passes de skills absents ne sont pas déclarés effectués. Aucun déploiement, migration ou changement de flag dans ce lot.
