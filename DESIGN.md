# Tartan — design system

Lu à chaque session de design. L'identité Tartan prime sur tout système généré (cahier des charges, chapitre 9).

**Intention.** L'énergie de la piste, la lisibilité du terrain, la sobriété d'un outil de travail. Le rouge brique du tartan est la seule couleur de marque ; tout le reste est neutre pour laisser la place aux séances, vidéos et statuts.

## Jetons

Source unique : `packages/design-tokens/src/index.ts`. Ne pas écrire de couleur ailleurs.

| Jeton                     | Valeur  | Usage                                        |
| ------------------------- | ------- | -------------------------------------------- |
| brand (Piste)             | #C4442B | Action principale, onglet actif, marque      |
| brandStrong (Piste foncé) | #9E3320 | Texte rouge sur clair, liens, onglet actif   |
| brandTint                 | #FBE7E2 | Fond d'alerte douce                          |
| ink (Encre)               | #15161A | Texte, fonds sombres (mode séance, vidéo)    |
| ink2                      | #24262C | Cartes sur fond sombre                       |
| muted                     | #5E6066 | Texte secondaire                             |
| bg (Craie)                | #F2F3F1 | Fond de l'app en clair                       |
| surface                   | #FFFFFF | Cartes, listes                               |
| border                    | #E2E3DF | Bordures et séparateurs                      |
| status.done (Couloir)     | #1E5FA8 | Fait, avec coche                             |
| status.partial (Sautoir)  | #E08A1E | Partiel, demi-disque, pictogramme seul       |
| status.missed             | #C4442B | Manqué, avec croix                           |
| status.upcoming           | #8C8E94 | À venir, contour pointillé, pictogramme seul |

Espacements : 4, 8, 12, 16, 20, 24, 32, 48, 64. Marge latérale mobile 16, desktop 24.
Rayons : 10 vignettes, 12 boutons carrés, 14 cartes, 16 blocs, 20 carte héros, plein pour les pastilles.
Bordures plutôt qu'ombres (lisibilité au soleil). Ombre légère seulement pour un élément flottant.
Cibles tactiles : 44 × 44 minimum.

## Typographie

Barlow Condensed pour les titres et les chiffres, Barlow pour le texte. Chiffres tabulaires pour hauteurs, charges, chronos, pourcentages.

| Rôle                   | Police                                         | Mobile   | Desktop  |
| ---------------------- | ---------------------------------------------- | -------- | -------- |
| Display                | Barlow Condensed Bold                          | 34/36    | 40/44    |
| Titre 1                | Barlow Condensed Bold                          | 28/32    | 32/36    |
| Titre 2                | Barlow Condensed SemiBold                      | 22/26    | 24/28    |
| Chiffre                | Barlow Condensed SemiBold                      | 18 à 34  | 18 à 40  |
| Corps                  | Barlow Regular/SemiBold                        | 15–16/22 | 15/22    |
| Légende                | Barlow Medium                                  | 12–13/16 | 12–13/16 |
| Titre de section court | Barlow SemiBold capitales, interlettrage 1–1,5 | 12–13    | 12–13    |

Le titre de section court ne se place jamais au-dessus d'un autre titre.

## Statuts

Jamais la couleur seule : fait = bleu + coche, partiel = orange + demi-disque, manqué = brique + croix, à venir = contour pointillé.

## Composants

- Bouton principal : fond Piste, texte blanc SemiBold 16, hauteur 48–52, pastille. Une seule action principale par écran.
- Bouton secondaire : fond blanc (encre en sombre), bordure 1 px, même hauteur.
- Bouton icône : 44 × 44, rond ou carré arrondi 12, libellé accessible obligatoire.
- Pastille de filtre : hauteur 36, pastille ; active = fond encre, texte blanc.
- Cellule de statut : disque 26 px avec pictogramme, cible tactile 44 px.
- Carte séance : type, titre, horaire · public, étiquettes de version (Club, Autonomie, Filmée). Séance de saut en fond Piste.
- Ligne d'exercice : vignette vidéo 44 px, nom, prescription en texte secondaire, étiquette de catégorie.
- Barre d'onglets : 5 entrées maximum, pictogramme + libellé 11 px, actif en Piste foncé.
- Champ : hauteur 44, libellé visible (ou masqué mais présent pour les lecteurs d'écran), coins 10–22.
- Timeline vidéo : segments par phase (luminosités alternées, phase courante en Piste), repères de commentaires, tête de lecture blanche.
- Feuille de barres : une pastille par hauteur, résultat dessous (O / XO / XXX), hauteur courante en Piste.
- Alerte : carte blanche, pastille d'icône teintée (brique ou orange), titre + détail, chevron.

## Scènes

Clair pour naviguer et planifier. Sombre pour le mode séance et l'analyse vidéo. Le choix suit la scène, pas la catégorie.

## Interdits (exigence « aucun AI slop »)

Un écran qui contient l'un de ces travers n'est pas terminé.

- Dégradés, texte en dégradé, halos colorés.
- Verre dépoli et flou décoratif.
- Grilles de cartes identiques (icône + titre + texte), cartes imbriquées.
- Gabarit « gros chiffre + petit libellé + statistiques ».
- Surtitre en capitales au-dessus d'un titre.
- Bordure colorée épaisse à gauche des cartes et alertes.
- Émojis ou caractères Unicode à la place d'icônes (Lucide, plus pictogrammes métier dessinés).
- Ombres dures ou lourdes.
- Police système comme voix de la marque.
- Faux contenu (lorem ipsum, statistiques inventées). Contenu réel du pilote ou repère explicite [À DÉFINIR].
- Animations d'apparition identiques partout : un seul moment animé qui a du sens (validation d'une séance, barre franchie).

## À vérifier sur chaque écran

Contraste 4,5:1 (3:1 gros titres), cibles 44 px, focus clavier visible. États : chargement, vide, erreur, désactivé, survol, contenu long, contenu réel. Éléments oubliés stylés : sélection de texte, barres de défilement, anneaux de focus, chiffres tabulaires. Textes dans la langue du coach et de l'athlète ; les boutons disent ce qu'ils font, les erreurs disent quoi faire.
