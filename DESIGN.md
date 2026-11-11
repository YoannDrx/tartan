# Tartan — design system

Lu à chaque session de design. Source produit : `PRODUCT.md` ; état effectivement livré : `docs/ETAT.md` ; déroulé de la refonte : `docs/plans/direction-artistique.md`.

**Décision du fondateur du 11 novembre 2026.** La direction artistique « Le stade » s'applique partout : les lignes blanches de la piste, droites et courbes, et un groupe de six athlètes reviennent d'un écran à l'autre. Les animations sont autorisées partout, écrans de travail compris, car la qualité se joue dans les détails. Cette décision remplace les règles « un seul grand moment animé » et « pas d'animation d'apparition ». Le site accueille un jeu, « Tartan Meeting ».

**Décision du fondateur du 9 novembre 2026.** Le mix d’origine revient par défaut : fond rouge piste, contenu sur des cartes encre, action citron, lignes blanches. Le thème **Tartan** est celui de tout nouvel utilisateur, sur le web et le mobile ; Automatique, Clair et Sombre restent au choix.

**Décision du fondateur du 8 novembre 2026.** La couleur tartan et les lignes blanches portent toute l’application. Chaque écran de travail ouvre sur un bandeau rouge piste, avec son titre en blanc et deux lignes de couloir d’un bord à l’autre ; la navigation est posée sur la même piste. Le contenu reste lisible dans le thème choisi.

## Deux régimes, une identité

### Travail

Calendrier, suivi, constructeur, bibliothèque, fiches athlètes, progrès, listes de vidéos, annonces, réglages, formulaires, accueil de l'athlète et écran de séance ouvrent sur le **bandeau piste** : fond `#C4442B`, titre blanc en Barlow Condensed, deux lignes blanches pleine largeur, action principale citron. Barre de navigation et barre d’onglets sont sur la même piste, séparées du contenu par une ligne blanche. Le bandeau ne change pas avec le thème.

Sous le bandeau, le contenu suit le thème choisi. En Tartan, par défaut : fond piste, cartes encre, texte blanc, action citron ; le texte posé directement sur la piste reste blanc, sans teinte atténuée. En clair : fond craie, surfaces blanches, texte encre, action rouge. En sombre : fond encre, surfaces relevées, texte blanc, action citron. Les séparations sont fines et les chiffres tabulaires. Une liste structurée est préférable à une succession de cartes décoratives. Une couleur n’est jamais le seul moyen de comprendre un état.

Les titres de bandeau font 40 px sur téléphone et 52 px sur ordinateur, les titres de section 20–22 px, le texte 15–16 px. Aucun texte sous 12 px ; les libellés de navigation font au moins 12 px. La navigation garde des cibles de 44 px au minimum.

Les dates s’affichent et se saisissent toujours en JJ/MM/AAAA, avec le calendrier maison : en-tête piste à deux lignes blanches, jour choisi dans la couleur d’action, année accessible d’un geste. Le serveur et les contrats conservent l’ISO.

**Téléphone d'abord.** Chaque écran est conçu à 390 px, puis élargi. Sur téléphone, l'action principale reste à portée de pouce (barre collante en bas quand le formulaire est long), un tableau devient une liste ou des cartes, et une comparaison se lit dans un écran dédié, en une colonne. Sur ordinateur, les comparaisons peuvent utiliser plusieurs colonnes et les détails un panneau. Les interfaces natives appliquent les mêmes rôles et intitulés. Les formulaires, feuilles, menus et dialogues suivent le thème choisi, y compris les éléments rendus dans un portail.

### Expression et immersion

Le site, la connexion, l'onboarding, les accueils et les états vides portent les aplats, les athlètes et les effets au défilement, avec une représentation équilibrée de la préparation physique. Le parcours présenté est « préparer → individualiser → réaliser → progresser ». Tout écran présenté sur le site est une vraie capture du produit, sur des données fictives indiquées comme telles ; aucune maquette recomposée.

Le site ouvre sur le film piloté par le défilement, qui raconte ce que l’athlète y gagne (voir ce qui arrive, savoir ce qu’il travaille, savoir sur quoi s’appliquer). Le film se joue en relais entre plusieurs athlètes et plusieurs épreuves : aucune spécialité n'est l'unique récit du produit. Il laisse le titre, la promesse et le bouton visibles dès l'ouverture, et reste court sur téléphone. Tout le contenu court ensuite le long d’une seule piste : les virages se touchent et aucune section ne s’intercale entre eux avant la ligne d’arrivée. Le jeu, les questions fréquentes et l'appel final viennent après la ligne d'arrivée.

La lecture/analyse vidéo, la capture et le mode séance restent encre : la couleur du fond ne doit pas distraire du geste. La célébration de validation reste citron. Une route historique conserve son adresse tant qu’une redirection compatible n’a pas été ajoutée.

## Les motifs du stade

Ces motifs sont des composants partagés, jamais redessinés à la main dans un écran.

| Motif | Rôle |
| --- | --- |
| Ligne droite, en double ligne de couloir | En-tête de chaque écran, séparateurs, rails de progression. Elle se trace de gauche à droite à l'arrivée sur l'écran |
| Virage, en couloirs concentriques | Transitions entre sections du site, fonds d'accueil et d'états vides |
| Tour de piste, en ovale | Progression : premiers pas du coach, semaine de l'athlète, série de régularité, chargements longs |
| Numéros de couloir, de 1 à 8 | Numérotation des étapes (onboarding, tarifs, aide), en Barlow Condensed |
| Ligne de départ, ligne d'arrivée, planche d'appel | Début et fin de parcours, zone de l'action principale |
| Le groupe | Six athlètes, un par épreuve et par rubrique |

## Palette et rôles

Source unique : `packages/design-tokens/src/index.ts`. Les valeurs CSS sont un miroir contrôlé par les tests. Aucun hexadécimal ni classe de palette brute (`bg-black`, `text-white`) dans les composants.

| Rôle        | Couleur   | Usage                                      |
| ----------- | --------- | ------------------------------------------ |
| Piste       | `#C4442B` | Marque et action principale sur clair      |
| Piste forte | `#9E3320` | Liens et états de survol sur clair         |
| Encre       | `#15161A` | Texte, immersion, navigation expressive    |
| Craie       | `#F2F3F1` | Fond de travail                            |
| Blanc       | `#FFFFFF` | Surfaces de travail                        |
| Citron      | `#C6F432` | Accent, célébration et sélection sur encre |

Les jetons `workTartan`, `work` et `workDark` définissent le contenu de travail dans chaque thème, `band` le bandeau piste ; `scene` conserve le contexte expressif et immersif. Les composants utilisent la palette locale : texte, texte secondaire, surface, séparateur, contour de contrôle, action, lien, focus et statut. Un composant partagé ne suppose jamais que sa surface est sombre.

Les mondes historiques Piste, Couloir, Craie, Soleil et Nuit restent des palettes expressives ; ils ne dictent plus la couleur des écrans de travail. La navigation quotidienne est sur la piste, avec sélection citron et libellé explicite. Les e-mails restent clairs dans toutes les messageries : bandeau piste avec logo complet et double ligne, message sur blanc, pied de page encre signé « Yodev, entreprise individuelle ». Chaque famille d'e-mails porte l'athlète qui lui correspond, en image fixe.

## Typographie et rythme

Barlow pour le texte ; Barlow Condensed pour les titres et chiffres. Titres de travail courts et alignés à gauche, sans mot isolé au marqueur. Le marqueur peut rester sur les titres expressifs du site et de l’accueil.

Grille de 4 px ; espacements de 4 à 64 px. Marge latérale mobile 16 px, desktop 24 px. Rayons cohérents : boutons 14 px, cartes 20 px ; pas de carte dans une carte. Cibles tactiles de 44 × 44 px. Aplats et bordures plutôt qu’ombres, sauf éléments flottants.

La couleur des séances et catégories sert la lecture du calendrier ; une spécialité ne bénéficie pas systématiquement d’un poids visuel supérieur. Les volumes et intensités conservent leurs unités et leur couverture de données.

## Composants et parcours

- Une action principale explicite par étape ; publication principale, brouillon secondaire, options avancées regroupées.
- Boutons secondaires sobres, contours et focus visibles sur leur surface réelle.
- Champs avec libellé permanent, erreur proche et annoncée, clavier suivant le thème ; les valeurs ne disparaissent pas sur une erreur.
- Cartes/listes de séance : titre, date, destinataires, état et catégorie avant les métadonnées secondaires.
- Contexte groupe/athlète/semaine conservé lors d’une consultation et d’un retour.
- Graphiques accompagnés d’une synthèse et d’un tableau ; aucun résultat manquant présenté comme mesuré.
- Installation proposée au bon moment, refermable ; aucune action cachée sous les barres fixes.
- Vidéo générale : « Vidéos » et « Analyse technique ». Barre, hauteur et phases techniques de saut seulement dans le contexte hauteur.

## Le groupe

Six athlètes aux prénoms fictifs, un seul squelette et un seul trait : membres à bouts ronds, aplats, mains, trois expressions (neutre, effort, joie), dossard. Une seule morphologie, pour que les appuis et les prises d'accessoire restent justes ; les teints, les coiffures et les tenues varient, femmes et hommes. Source unique : le paquet `packages/mascot` (créé par le lot B2), partagé par le site, l'application, le jeu et le mobile. Chaque teint est vérifié contre la piste, l'encre et la craie.

| Épreuve | Accessoire | Rubrique associée |
| --- | --- | --- |
| Haies | Haie | Calendrier |
| Perche | Perche qui fléchit, barre | Progrès |
| Triple saut | Planche, sable | Constructeur et séances |
| Disque | Disque, secteur | Exercices |
| Longueur | Planche, sable | Suivi |
| Hauteur | Barre, tapis | Vidéos |

Un athlète accompagne un accueil, un état vide, un chargement long, une erreur, une célébration, un e-mail. Il ne remplace jamais une information ou une action, et ne s'interpose pas entre l'utilisateur et sa tâche.

## Mouvement

**Règle d'or : l'animation suit l'état, elle ne le précède jamais.** Rien ne retarde une action : l'écran est utilisable dès la première image, tout mouvement est interruptible, et le chemin de validation de l'athlète ne porte aucune animation de plus de 200 ms avant le résultat.

- **Jetons.** Durées et courbes vivent dans `packages/design-tokens/src/motion.ts` (créé par le lot B1), en miroir dans le CSS. Aucune durée ni courbe écrite en dur dans un composant. Trois courbes, nommées d'après le geste : élan, impulsion, réception.
- **Écrans de travail.** Les lignes de l'en-tête se tracent à l'arrivée ; l'onglet actif glisse ; les compteurs défilent ; feuilles, menus et dialogues entrent et sortent ; une carte de séance s'ouvre en écran de séance ; le bandeau piste reste en place d'une page à l'autre. Entrées de 260 ms au plus, cascade limitée à six éléments. Pas d'apparition déclenchée par le défilement dans un écran de travail.
- **Site, connexion, onboarding, accueils, états vides.** Effets au défilement, athlètes animés, parallaxe légère des captures.
- **Grands moments.** La validation d’une séance faite, qui peut intégrer les records confirmés de cette séance ; un record ; la fin des premiers pas ; la fin d'une épreuve du jeu. Pas de rejeu après synchronisation ni dans l’historique. Une validation partielle ne déclenche pas la célébration. Pas de son.
- **Mouvement réduit.** `prefers-reduced-motion` coupe tout mouvement non essentiel, transitions de page comprises. Toute animation est déclarée sous `no-preference`, et un test le vérifie. Le jeu reste jouable, sans tremblement, parallaxe ni confettis.
- **Technique.** CSS et View Transitions ; pas de bibliothèque d'animation sans décision explicite.

## Le jeu

« Tartan Meeting » vit sur le site : un aperçu jouable après la ligne d'arrivée de la page d'accueil, le jeu complet sur `/jeu`. Il se joue au pouce, d'un seul geste (appuyer, tenir, relâcher), et au clavier. La scène est encre et piste, avec les athlètes du groupe ; l'affichage tête haute, les résultats et le classement sont en HTML, dans les composants partagés. Le jeu ne retarde jamais le chargement de la page d'accueil. Sur iOS et Android, aucune mention de prix n'y figure.

## Recette

Chaque écran passe par UI/UX Pro Max, Frontend Design et Impeccable quand ces compétences sont disponibles, en conservant le contexte produit. Les suggestions génériques de landing ou de styles décoratifs ne remplacent pas ces décisions.

Vérifier 390, 768 et 1440 px, clavier, zoom 200 %, mouvement réduit, contenus longs, 30/60/120 athlètes et barres fixes. Contraste texte 4,5:1, gros texte 3:1, contrôles/focus 3:1. Vérifier les portails, menus et retours d’erreur dans le bon thème. VoiceOver/TalkBack et appareils physiques restent des recettes distinctes des exports et tests automatisés.

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
- Animation qui retarde une action, qui ne s'interrompt pas, ou qui ignore le mouvement réduit.
- Texte ou couleur en dur dans un composant.

## À vérifier sur chaque écran

Contraste 4,5:1 (3:1 gros titres), cibles 44 px, focus clavier visible, dans le monde réel de l'écran. États : chargement, vide, erreur, désactivé, survol, contenu long, contenu réel. Éléments oubliés stylés : sélection de texte, barres de défilement, anneaux de focus, chiffres tabulaires. Textes dans la langue du coach et de l'athlète ; les boutons disent ce qu'ils font, les erreurs disent quoi faire.
