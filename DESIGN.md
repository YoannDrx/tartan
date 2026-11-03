# Tartan — design system

Lu à chaque session de design. L'identité Tartan prime sur tout système généré (cahier des charges, chapitre 9).

**Intention.** Une affiche d'athlétisme qui s'anime : aplats vifs, formes franches, un personnage qui saute. Chaque rubrique a son monde de couleur, les données restent posées sur des cartes encre, et le citron signale ce qu'on peut faire et ce qui est fait. Aucune autre app de coach ne ressemble à ça, et c'est le but.

Décision du fondateur (3 novembre 2026), qui remplace la direction « sombre et rouge » du 1er novembre et le « clair par défaut » du cahier (§ 9.9) : **cette direction s'applique au site et aux applications, sur toutes les pages.**

## Deux régimes

- **Le site public** cherche à convaincre : le film du saut, les mots qui rebondissent, le spectacle assumé.
- **L'application** sert une tâche : même univers, mais lisibilité d'abord. Pas d'animation au chargement, transitions de 150 à 250 ms, un seul grand moment animé. Le critère reste : valider en moins de 10 secondes côté athlète, lisible au soleil sur le terrain.

## Les mondes

Le fond change franchement d'une rubrique à l'autre, sans fondu. Source web : `apps/web/src/lib/world.ts` et les classes `.world-*`. Le mobile applique la même répartition.

| Monde   | Fond             | Texte | Où                                                                   |
| ------- | ---------------- | ----- | -------------------------------------------------------------------- |
| Piste   | Rouge `#C4442B`  | Blanc | Accueil, Aujourd'hui, séance, connexion, invitations, site           |
| Couloir | Bleu électrique  | Blanc | Suivi, calendrier, séances, tarifs                                   |
| Craie   | Craie `#F2F3F1`  | Encre | Exercices, annonces, réglages, abonnement, textes légaux             |
| Soleil  | Jaune `#FFC838`  | Encre | Athlètes, progrès, contact                                           |
| Nuit    | Encre `#15161A`  | Blanc | Vidéos et mes sauts, mode séance, analyse vidéo, capture, hors ligne |
| Citron  | Citron `#C6F432` | Encre | Réservé au moment de validation et à sa séquence dans le film        |

La vidéo et le mode séance restent sur encre : l'effort prime, et une couleur vive fausserait la perception de l'image.

### Règles

- **Les données vivent sur des cartes encre** (`scene.card`). Pas de carte dans une carte : à l'intérieur, on structure par lignes (`scene.cardLine`) et par rangées surélevées (`scene.cardRaised`). Dans le monde Nuit, les cartes passent à `ink2`.
- **Sur un monde, le texte a une seule couleur** : blanc sur Piste, Couloir et Nuit, encre sur Craie et Soleil. Pas de secondaire grisé ou teinté directement sur un fond plein.
- **Une couleur de texte s'écrit avec un rôle** (`--ctx-*`, `bg-accent`, `text-on-accent`, `text-on-page`), jamais en dur : un même composant traverse tous les mondes.
- **Les lignes de couloir restent la signature** : traits pleins de 3 px à bord perdu, de la couleur du texte du monde, sous le titre d'écran et entre grandes sections. La ligne d'arrivée (7 px) coupe la piste du site une seule fois et signale une séance de saut dans le calendrier.
- **Une carte héros par écran au maximum** peut passer en craie (`scene.hero`) : c'est le point focal, comme la séance du jour.
- **Le logo** : logotype seul sur un monde, de la couleur du texte ; icône complète autorisée sur l'encre.
- Barres de navigation : encre, onglet actif citron avec texte et pictogramme encre.
- Les e-mails restent clairs : ils s'affichent dans la messagerie de chacun.

## L'accent citron

Le citron sert aux actions principales, à la sélection, au statut « fait » et au marqueur. Il suit le fond :

- sur Piste, Couloir, Nuit et les cartes encre : fond citron, texte encre ;
- sur Craie, Soleil et la carte héros : fond encre, texte citron.

Sur le rouge, le citron atteint 3,9:1 : il ne sert jamais de couleur de texte. Sur l'encre, il sert aussi aux liens. Le rouge reste la marque et le type « saut » : il n'indique plus une sélection.

## Le marqueur

Le dernier mot de chaque titre d'écran est posé sur un aplat d'accent (`Marked`), tracé une fois à l'arrivée sur l'écran. Pas de marqueur ailleurs que sur les titres d'écran et de section du site : il perdrait sa force.

## La mascotte

Un personnage en aplats : tête ronde, deux yeux en points, membres épais, baskets citron (`Jumper`, poses et proportions dans `packages/design-tokens/src/jumper.ts`). Elle occupe les états vides, les erreurs, le hors-ligne et le moment de validation. Elle est décorative : le texte voisin porte le sens. Elle ne remplace ni une donnée ni une action.

## Le mouvement

- **Un seul grand moment dans l'application : la validation d'une séance faite** (`Victory`). Une seconde plein écran en citron, coche, mascotte et confettis, sans bloquer l'écran ni retarder l'envoi. Une validation partielle n'y a pas droit.
- **Sur le site public** : le film du saut piloté par le défilement, le tracé des couloirs et le même moment dans la démonstration.
- Avec la réduction des animations ou sans JavaScript, ces animations disparaissent : image fixe et textes empilés.

## Statuts

Sur l'encre, les statuts utilisent `scene.status` (`done` citron, `partial` soleil, `missed` corail, `upcoming` gris), pictogramme encre (`scene.onStatus`) dans le disque. Les valeurs `color.status` restent celles des fonds clairs (carte héros, e-mails). **Jamais la couleur seule :** fait = coche, partiel = demi-disque, manqué = croix, à venir = contour pointillé.

### Exigence de soin

Tout est aligné sur la grille de 4, chiffres tabulaires partout, rythme vertical constant. Sélection de texte, focus, barres de défilement, états vides : tout porte l'identité. Un écran correct mais quelconque n'est pas terminé.

## Jetons

Source unique : `packages/design-tokens/src/index.ts`. Ne pas écrire de couleur ailleurs. Les rôles à l'écran viennent de `tokens.scene`, la palette vive de `color.film`.

| Jeton             | Valeur  | Usage                                      |
| ----------------- | ------- | ------------------------------------------ |
| brand (Piste)     | #C4442B | Monde Piste, marque, type « saut »         |
| brandStrong       | #9E3320 | Piste foncé, survol, texte rouge sur clair |
| ink (Encre)       | #15161A | Texte sur clair, cartes, monde Nuit        |
| ink2              | #24262C | Rangées surélevées, cartes du monde Nuit   |
| bg (Craie)        | #F2F3F1 | Monde Craie, carte héros, e-mails          |
| film.electric     | #2B4DFF | Monde Couloir                              |
| film.electricDeep | #1E37C2 | Survol sur Couloir                         |
| film.lime         | #C6F432 | Accent, statut fait, moment de validation  |
| film.limeDeep     | #AEDB1E | Survol de l'accent                         |
| film.sun          | #FFC838 | Monde Soleil, statut partiel, tapis        |
| film.sunDeep      | #EFB21C | Survol sur Soleil                          |
| film.sunLight     | #FFE08A | Dessus du tapis dans le film               |
| film.skin         | #E8A87C | Peau de la mascotte                        |

Espacements : 4, 8, 12, 16, 20, 24, 32, 48, 64. Marge latérale mobile 16, desktop 24.
Rayons : 12 vignettes, 14 boutons carrés, 20 cartes, 24 blocs, 28 carte héros, plein pour les pastilles.
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

## Composants

- Bouton principal : accent, SemiBold 16, hauteur 48–52, pastille. Une seule action principale par écran.
- Bouton secondaire : sur un monde, contour 2 px de la couleur du texte ; sur l'encre, fond `cardRaised`, bordure `cardLine`.
- Bouton icône : 44 × 44, rond ou carré arrondi, libellé accessible obligatoire.
- Pastille de filtre : hauteur 36, pastille. Active : accent. Inactive : contour sur un monde, fond `cardRaised` sur l'encre.
- Cellule de statut : disque 26 px avec pictogramme, cible tactile 44 px.
- Carte séance : type, titre, horaire · public, étiquettes de version (Club, Autonomie, Filmée), sur encre. Séance de saut signalée par une ligne d'arrivée et un pictogramme de barre.
- Ligne d'exercice : vignette vidéo 44 px, nom, prescription en texte secondaire, étiquette de catégorie.
- Barre d'onglets : 5 entrées maximum, pictogramme + libellé 11 px, fond encre, actif citron.
- Champ : hauteur 44, libellé visible (ou masqué mais présent pour les lecteurs d'écran), coins 10–22.
- Timeline vidéo : segments par phase (luminosités alternées, phase courante en citron), repères de commentaires, tête de lecture blanche.
- Feuille de barres : une pastille par hauteur, résultat dessous (O / XO / XXX), hauteur courante en citron.
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
- Animations d'apparition sur les écrans de l'application.

## À vérifier sur chaque écran

Contraste 4,5:1 (3:1 gros titres), cibles 44 px, focus clavier visible, dans le monde réel de l'écran. États : chargement, vide, erreur, désactivé, survol, contenu long, contenu réel. Éléments oubliés stylés : sélection de texte, barres de défilement, anneaux de focus, chiffres tabulaires. Textes dans la langue du coach et de l'athlète ; les boutons disent ce qu'ils font, les erreurs disent quoi faire.
