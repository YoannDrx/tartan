# Tartan — design system

Lu à chaque session de design. L'identité Tartan prime sur tout système généré (cahier des charges, chapitre 9).

**Intention.** Une direction artistique très marquée, très soignée. On ouvre Tartan et on est sur la piste : le rouge brique du tartan remplit l'écran, les lignes blanches de couloir le structurent, le contenu se pose sur des cartes encre. Aucune autre app ne ressemble à ça, et c'est le but.

Décision du fondateur (1er novembre 2026), qui remplace le « clair par défaut » du cahier (§ 9.9) : **l'app est sombre et rouge, il n'y a plus de mode clair.**

## Le système : trois scènes

| Scène                  | Fond                                           | Où                                                                                                             | Pourquoi                                                                                        |
| ---------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Piste** (par défaut) | Rouge piste plein écran                        | Toute la navigation : suivi, calendrier, exercices, athlètes, annonces, réglages, Aujourd'hui, connexion, site | L'identité : on est sur le tartan                                                               |
| **Encre**              | Encre pleine                                   | Mode séance, analyse vidéo                                                                                     | La vidéo et l'effort priment, le rouge fatiguerait l'œil et fausserait la perception de l'image |
| **Lecture**            | Rouge piste, texte dans une grande carte encre | Pages légales et textes longs                                                                                  | Lire longtemps sur du rouge est pénible                                                         |

### Règles de la scène Piste

- **Le rouge est le fond, jamais une carte.** Le contenu vit sur des cartes encre (`scene.card`, rayon 14). Pas de carte rouge sur fond rouge, pas de carte dans une carte : à l'intérieur d'une carte, on structure par lignes (`scene.cardLine`) et par rangées surélevées (`scene.cardRaised`).
- **Les lignes de couloir sont la signature.** Traits blancs pleins de 3 px, à bord perdu, jamais translucides. Sous le titre d'écran et entre grandes sections. La ligne d'arrivée (verticale, 7 px, plus du double) a deux usages et pas d'autre : couper la piste du site, une seule fois ; signaler une séance de saut, au bord droit de sa carte dans le calendrier, où elle se répète avec les séances puisque c'est un marqueur de type. Pas de damier, de dégradé, d'ombre ni de reflet sur ces lignes.
- **Les titres d'écran sont posés directement sur le rouge**, en blanc, Barlow Condensed Bold, et grands : c'est là que se joue la force de l'identité. Augmente le corps plutôt que d'ajouter un élément.
- **Sur le rouge, tout le texte est blanc** (5,0:1). L'encre y échoue (3,6:1), comme tout texte secondaire grisé, rosé ou translucide : l'encre n'existe sur le rouge qu'en surface. L'action principale sur le rouge est un bouton blanc, texte encre.
- **Dans une carte encre**, l'action principale est rouge piste, texte blanc. Texte blanc, secondaire `scene.textMuted`, liens `scene.link`. Les contours de champs utilisent `scene.controlLine` (3:1), `scene.cardLine` reste aux séparateurs décoratifs.
- **Une carte héros par écran au maximum** peut passer en craie (`scene.hero`, texte encre) : c'est le point focal, comme la séance du jour. Elle ne devient pas une habitude.
- **Le logo** : logotype blanc seul sur le rouge (le cahier interdit l'icône rouge sur fond rouge) ; icône complète autorisée sur l'encre.
- Barres de navigation : encre, onglet actif avec pictogramme et libellé blancs sur une pastille rouge piste. La barre système est en contenu clair.
- Les e-mails restent clairs : ils s'affichent dans la messagerie de chacun.

### Statuts

Sur l'encre, les statuts utilisent `scene.status` (`done` #4C8FE0, `partial` #E08A1E, `missed` #F0644C, `upcoming` #8C8E94), pictogramme encre (`scene.onStatus`) dans le disque. Le pictogramme reste distinct par statut, jamais la couleur seule. Les valeurs `color.status` restent celles des fonds clairs (carte héros craie, e-mails).

### Exigence de soin

Tout est aligné sur la grille de 4, chiffres tabulaires partout, rythme vertical constant. Sélection de texte, focus (blanc sur le rouge, `scene.link` sur l'encre), barres de défilement, états vides : tout porte l'identité. Un seul moment animé : la validation d'une séance (coche), éventuellement la barre franchie. Un écran correct mais quelconque n'est pas terminé.

## Jetons

Source unique : `packages/design-tokens/src/index.ts`. Ne pas écrire de couleur ailleurs. Les rôles à l'écran viennent de `tokens.scene` ; le tableau ci-dessous donne les couleurs de base du cahier.

| Jeton                     | Valeur  | Usage                                        |
| ------------------------- | ------- | -------------------------------------------- |
| brand (Piste)             | #C4442B | Action principale, onglet actif, marque      |
| brandStrong (Piste foncé) | #9E3320 | Texte rouge sur clair, liens, onglet actif   |
| brandTint                 | #FBE7E2 | Fond d'alerte douce                          |
| ink (Encre)               | #15161A | Texte, fonds sombres (mode séance, vidéo)    |
| ink2                      | #24262C | Cartes sur fond sombre                       |
| muted                     | #5E6066 | Texte secondaire                             |
| bg (Craie)                | #F2F3F1 | Carte héros, e-mails                         |
| surface                   | #FFFFFF | Cartes, listes                               |
| border                    | #E2E3DF | Bordures et séparateurs                      |
| status.done (Couloir)     | #1E5FA8 | Fait, avec coche                             |
| status.partial (Sautoir)  | #E08A1E | Partiel, demi-disque, pictogramme seul       |
| status.missed             | #C4442B | Manqué, avec croix                           |
| status.upcoming           | #8C8E94 | À venir, contour pointillé, pictogramme seul |

Espacements : 4, 8, 12, 16, 20, 24, 32, 48, 64. Marge latérale mobile 16, desktop 24.
Rayons : 10 vignettes, 12 boutons carrés, 14 cartes, 16 blocs, 20 carte héros, plein pour les pastilles.
Aplats et bordures plutôt qu'ombres (lisibilité au soleil). Ombre légère seulement pour un élément flottant.
Cibles tactiles : 44 × 44 minimum.

## Typographie

Barlow Condensed pour les titres et les chiffres, Barlow pour le texte. Chiffres tabulaires pour hauteurs, charges, chronos, pourcentages.

Source : `apps/web/app/globals.css`, classes `.t-*`. Bascule à 1024 px.

| Rôle                    | Classe       | Police                    | Mobile  | Desktop |
| ----------------------- | ------------ | ------------------------- | ------- | ------- |
| Titre d'écran (Display) | `.t-display` | Barlow Condensed Bold     | 52/52   | 80/80   |
| Titre 1                 | `.t-h1`      | Barlow Condensed Bold     | 36/40   | 44/48   |
| Titre 2                 | `.t-h2`      | Barlow Condensed SemiBold | 24/28   | 26/30   |
| Titre de section        | `.t-section` | Barlow Condensed SemiBold | 20/24   | 20/24   |
| Chiffre                 | `.t-num`     | Barlow Condensed SemiBold | 17 à 34 | 17 à 40 |
| Corps                   | base         | Barlow Regular/SemiBold   | 15/22   | 15/22   |
| Légende                 | `.t-caption` | Barlow Medium             | 13/18   | 13/18   |
| En-tête de colonne      | `.t-col`     | Barlow SemiBold           | 13/16   | 13/16   |

Aucun texte en capitales d'affichage : ni au-dessus d'une section, ni en en-tête de colonne (§ 9.11).

## Statuts

Jamais la couleur seule : fait = bleu + coche, partiel = orange + demi-disque, manqué = brique + croix, à venir = contour pointillé.

## Composants

- Bouton principal : blanc texte encre sur le rouge, rouge piste texte blanc sur l'encre. SemiBold 16, hauteur 48–52, pastille. Une seule action principale par écran.
- Bouton secondaire : sur le rouge, contour blanc 2 px et texte blanc ; sur l'encre, fond `cardRaised`, bordure `cardLine`.
- Bouton icône : 44 × 44, rond ou carré arrondi 12, libellé accessible obligatoire.
- Pastille de filtre : hauteur 36, pastille. Sur le rouge : active = fond blanc, texte encre ; inactive = contour blanc. Sur l'encre : active = fond blanc, texte encre ; inactive = fond `cardRaised`.
- Cellule de statut : disque 26 px avec pictogramme, cible tactile 44 px.
- Carte séance : type, titre, horaire · public, étiquettes de version (Club, Autonomie, Filmée), sur encre. Séance de saut signalée par une ligne d'arrivée et un pictogramme de barre, puisque le rouge est désormais le fond.
- Ligne d'exercice : vignette vidéo 44 px, nom, prescription en texte secondaire, étiquette de catégorie.
- Barre d'onglets : 5 entrées maximum, pictogramme + libellé 11 px, fond encre, actif blanc sur pastille rouge piste.
- Champ : hauteur 44, libellé visible (ou masqué mais présent pour les lecteurs d'écran), coins 10–22.
- Timeline vidéo : segments par phase (luminosités alternées, phase courante en Piste), repères de commentaires, tête de lecture blanche.
- Feuille de barres : une pastille par hauteur, résultat dessous (O / XO / XXX), hauteur courante en Piste.
- Alerte : ligne dans une carte encre, pastille d'icône pleine (`missed` ou `partial`), titre + détail, chevron.

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
