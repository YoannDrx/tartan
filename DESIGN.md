# Tartan — design system

Lu à chaque session de design. Source produit : `PRODUCT.md` ; état effectivement livré : `docs/ETAT.md` ; déroulé de la refonte : `docs/plans/direction-artistique.md`.

**Décision du fondateur du 11 novembre 2026.** La direction artistique « Le stade » s'applique partout : les lignes blanches de la piste, droites et courbes, et un groupe de six athlètes reviennent d'un écran à l'autre. Les animations sont autorisées partout, écrans de travail compris, car la qualité se joue dans les détails. Cette décision remplace les règles « un seul grand moment animé » et « pas d'animation d'apparition ». Le site accueille un jeu, « Tartan Meeting ».

**Décision du fondateur du 9 novembre 2026.** Le mix d’origine revient par défaut : fond rouge piste, contenu sur des cartes encre, action citron, lignes blanches. Le thème **Tartan** est celui de tout nouvel utilisateur, sur le web et le mobile ; Automatique, Clair et Sombre restent au choix.

**Décision du fondateur du 8 novembre 2026.** La couleur tartan et les lignes blanches portent toute l’application. Chaque écran de travail ouvre sur un bandeau rouge piste, avec son titre en blanc et deux lignes de couloir d’un bord à l’autre ; la navigation est posée sur la même piste. Le contenu reste lisible dans le thème choisi.

## Deux régimes, une identité

### Travail

Calendrier, suivi, constructeur, bibliothèque, fiches athlètes, progrès, listes de vidéos, annonces, réglages, formulaires, accueil de l'athlète et écran de séance ouvrent sur le **bandeau piste** : fond `#C4442B`, titre blanc en Barlow Condensed, deux lignes blanches pleine largeur, action principale citron. Barre de navigation et barre d’onglets sont sur la même piste, séparées du contenu par une ligne blanche. Le bandeau ne change pas avec le thème.

Sous le bandeau, le contenu suit le thème choisi. En Tartan, par défaut : fond piste, cartes encre, texte blanc, action citron ; le texte posé directement sur la piste reste blanc, sans teinte atténuée. En clair : fond craie, surfaces blanches, texte encre, action rouge. En sombre : fond encre, surfaces relevées, texte blanc, action citron. Les séparations sont fines et les chiffres tabulaires. Une liste structurée est préférable à une succession de cartes décoratives. Une couleur n’est jamais le seul moyen de comprendre un état.

Les titres de bandeau font 40 px sur téléphone et 52 px sur ordinateur, les titres de section 20–22 px, le texte 15–16 px. Sur téléphone, les actions du bandeau tiennent sur une seule ligne qui défile de côté, l'action principale en premier. Aucun texte sous 12 px, ce qu'un test vérifie dans les composants comme dans la feuille de styles ; les libellés de navigation font au moins 12 px. La navigation garde des cibles de 44 px au minimum.

Les dates s’affichent et se saisissent toujours en JJ/MM/AAAA, avec le calendrier maison : en-tête piste à deux lignes blanches, jour choisi dans la couleur d’action, année accessible d’un geste. Le serveur et les contrats conservent l’ISO.

**Téléphone d'abord.** Chaque écran est conçu à 390 px, puis élargi. Sur téléphone, l'action principale reste à portée de pouce (barre collante en bas quand le formulaire est long), un tableau devient une liste ou des cartes, et une comparaison se lit dans un écran dédié, en une colonne. Sur ordinateur, les comparaisons peuvent utiliser plusieurs colonnes et les détails un panneau. Les interfaces natives appliquent les mêmes rôles et intitulés. Les formulaires, feuilles, menus et dialogues suivent le thème choisi, y compris les éléments rendus dans un portail.

### Expression et immersion

Le site, la connexion, l'onboarding, les accueils et les états vides portent les aplats, les athlètes et les effets au défilement, avec une représentation équilibrée de la préparation physique. Le parcours présenté est « préparer → individualiser → réaliser → progresser ». Tout écran présenté sur le site est une vraie capture du produit, sur des données fictives indiquées comme telles ; aucune maquette recomposée.

Le site ouvre sur le film piloté par le défilement, qui raconte ce que l’athlète y gagne (voir ce qui arrive, savoir ce qu’il travaille, savoir sur quoi s’appliquer). Le film se joue en relais entre plusieurs athlètes et plusieurs épreuves : aucune spécialité n'est l'unique récit du produit. Il laisse le titre, la promesse et le bouton visibles dès l'ouverture, et reste court : 7,5 hauteurs d'écran sur téléphone, 10 sur ordinateur (décision du 12 novembre 2026). Inès court les haies pour « voir ce qui arrive », Malo monte à la perche pour « savoir ce qu'il travaille », Noé franchit la barre pour « savoir sur quoi s'appliquer », jusqu'à la validation ; chacun traverse son monde, et le passage de relais est un changement de monde franc. Tout le contenu court ensuite le long d’une seule piste : les virages se touchent et aucune section ne s’intercale entre eux avant la ligne d’arrivée. Le jeu, les questions fréquentes (six questions du centre d'aide, reprises mot pour mot) et l'appel final viennent après la ligne d'arrivée. Sur téléphone, une capture précède toujours le texte qui la commente, en une colonne ; les tarifs se lisent en une carte par offre, le tableau complet replié sous « Tout comparer ».

La lecture/analyse vidéo, la capture et le mode séance restent encre : la couleur du fond ne doit pas distraire du geste. La célébration de validation reste citron. Une route historique conserve son adresse tant qu’une redirection compatible n’a pas été ajoutée.

## Les motifs du stade

Ces motifs sont des composants partagés, jamais redessinés à la main dans un écran : `src/components/track.tsx`, `lane-number.tsx`, `athlete.tsx` et `event-scene.tsx`. Ils prennent la couleur des lignes du fond où ils sont posés (`--color-lane`).

| Motif | Composant | Rôle |
| ----------- | --------- | ------------------------------------------ |
| Ligne droite, en double ligne de couloir | `TrackLine` | En-tête de chaque écran, séparateurs, rails de progression. Elle se trace de gauche à droite à l'arrivée sur l'écran |
| Virage, en couloirs concentriques | `TrackBend` | Transitions entre sections du site, fonds d'accueil et d'états vides |
| Tour de piste, en ovale | `TrackLap` | Progression : premiers pas du coach, semaine de l'athlète, série de régularité, chargements longs. La part courue se dit aussi en toutes lettres |
| Numéros de couloir, de 1 à 8 | `LaneNumber` | Numérotation des étapes (onboarding, tarifs, aide), en Barlow Condensed |
| Ligne de départ, ligne d'arrivée, planche d'appel | `StartLine`, `FinishLine`, `TakeoffBoard` | Début et fin de parcours, zone de l'action principale |
| Le groupe | `Athlete`, `EventScene` | Six athlètes, un par épreuve et par rubrique |

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

Grille de 4 px ; espacements de 4 à 64 px. Marge latérale mobile 16 px, desktop 24 px. Rayons cohérents : boutons 14 px, cartes 20 px ; pas de carte dans une carte décorative. Exception décidée le 13 novembre : les cartes du constructeur représentent la structure réelle d'un circuit ou superset, avec deux niveaux de groupes répétés au maximum. Les couleurs sémantiques de préparation, force, vitesse/pliométrie et récupération passent par les jetons ; libellés et structure restent compréhensibles sans couleur. Le contenant « à répéter » montre les tours et les récupérations, sans bordure colorée épaisse à gauche. Cibles tactiles de 44 × 44 px. Aplats et bordures plutôt qu’ombres, sauf éléments flottants.

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

| Couloir | Prénom | Épreuve | Accessoire | Rubrique associée | Coiffure, teint |
| --- | --- | --- | --- | --- | --- |
| 1 | Inès | Haies | Haie | Calendrier | Queue de cheval, clair |
| 2 | Malo | Perche | Perche qui fléchit, barre, tapis | Progrès | Afro, profond |
| 3 | Awa | Triple saut | Planche, sable | Constructeur et séances | Chignon, hâlé |
| 4 | Mehdi | Disque | Disque, cercle, secteur | Exercices | Coupe courte, hâlé |
| 5 | Lila | Longueur | Planche, sable | Suivi | Queue de cheval, pêche |
| 6 | Noé | Hauteur | Barre, tapis | Vidéos | Coupe courte, pêche. Le personnage d'origine |

Le dossard porte le numéro de couloir et reste lisible quand le corps se retourne. Chaque épreuve a son geste complet, de la mise en place à la réussite (`@tartan/mascot/events`) : un film, un écran ou le jeu choisit l'instant, rien ne dépend d'une horloge. Le visage suit le geste : neutre avant, à l'effort pendant, joyeux une fois réussi.

Les sautoirs de hauteur et de perche ont les couleurs des tapis de stade : corps bleu, dessus rouge, liseré blanc au bord du dessus, qui le détache de la piste (`film.matBlue`, `film.matRed`).

Les couleurs du groupe vivent dans `packages/design-tokens/src/athletes.ts`. Deux aplats voisins (un teint et son fond, un bras et un maillot, des cheveux et un visage) sont séparés d'au moins 0,12 dans l'espace Oklab, sur la piste, l'encre et la craie, et sur les deux autres mondes que traverse le film (le bleu du couloir, le citron de la validation) : un contraste de luminance ne suffit pas, un brun et le rouge de la piste ont la même clarté. Conséquences assumées : aucun cheveu n'est noir, il se perdrait sur l'encre ; les cheveux de Malo sont blonds, pour se détacher de son teint ; un maillot blanc ou encre change de couleur sur le fond qui l'effacerait.

La planche de contrôle `/admin/mascotte` montre le groupe sur ses cinq fonds, les visages, les poses, les six gestes et les motifs. Le fondateur a décidé le 12 novembre 2026 d'avancer sans attendre sa revue de la planche : les athlètes sont déjà sur la page d'accueil (le film, la bande du groupe), la page introuvable et la page hors ligne. Une correction issue de la revue se fait à un seul endroit par sujet : les prénoms dans `packages/i18n`, les couleurs dans `packages/design-tokens`, les gestes dans `packages/mascot`.

Un athlète accompagne un accueil, un état vide, un chargement long, une erreur, une célébration, un e-mail. Il ne remplace jamais une information ou une action, et ne s'interpose pas entre l'utilisateur et sa tâche. Dans un écran de travail, il se tient sur un bout de piste (`TrackTile`) : le rouge et la ligne blanche ne changent pas avec le thème, donc sa tenue reste lisible sur une carte claire comme sur une carte encre. Chaque état vide porte l'athlète de sa rubrique (`src/lib/rubric-athlete.ts`) ; les rubriques que la table ne nomme pas prennent celui de la rubrique la plus proche.

Les pages d'entrée posent le groupe sur une ligne de piste (`src/features/shell/start-scene.tsx`), à droite du formulaire sur ordinateur, à la place des virages. La connexion aligne les trois athlètes du relais de la page d'accueil, aussi sous le formulaire sur téléphone. La création de l'espace montre Inès sur ordinateur seulement, le formulaire gardant tout l'écran du téléphone : sa pose suit le temps affiché (à vos marques, elle se place ; prêts, elle se concentre ; partez, elle s'élance), lue en CSS sur l'attribut `data-step` du formulaire.

La carte de record (`src/features/progress/record-card.tsx`) est une image portrait de 1080 × 1350 sur la piste : la marque en encre sur un bloc citron, en Barlow Condensed, l'athlète de l'épreuve qui lève les bras sur les deux lignes du couloir. Une discipline hors des six épreuves prend Malo, l'athlète des progrès (`src/lib/discipline-athlete.ts`).

Dans un e-mail, un athlète se tient à droite du logo, les pieds sur les lignes du bandeau, pour un accueil ou une bonne nouvelle : bienvenue du coach, invitation, bienvenue de l'athlète, conseils d'activation, abonnement confirmé. Les e-mails de sécurité, de paiement et d'avertissement restent sans illustration. Les messageries n'affichent pas le SVG : les images sont des PNG tirés du groupe par `pnpm --filter @tartan/web email:athletes`, déclarés dans `apps/web/emails/athletes.ts`.

## Mouvement

**Règle d'or : l'animation suit l'état, elle ne le précède jamais.** Rien ne retarde une action : l'écran est utilisable dès la première image, tout mouvement est interruptible, et le chemin de validation de l'athlète ne porte aucune animation de plus de 200 ms avant le résultat.

- **Jetons.** Durées et courbes vivent dans `packages/design-tokens/src/motion.ts`, en miroir dans `globals.css`. Aucune durée ni courbe écrite en dur : le lint le refuse dans les composants (`tartan/no-raw-motion`), un test dans la feuille de styles.

  | Durée | Valeur | Usage |
  | --- | --- | --- |
  | `instant` | 80 ms | Retour d'un geste : pression, survol |
  | `quick` | 150 ms | Changement d'état d'un contrôle. Valeur par défaut de toute transition |
  | `base` | 200 ms | Plafond sur le chemin de validation de l'athlète |
  | `enter` | 260 ms | Entrée d'une feuille, d'un menu, d'un dialogue. Plafond des écrans de travail |
  | `trace` | 320 ms | Tracé d'une ligne ou d'une coche |
  | `expressive` | 420 ms | Apparition sur le site, les accueils, les états vides |
  | `celebration` | 1 150 ms | Grand moment |
  | `ambient` | 4 400 ms | Période d'un mouvement d'ambiance qui boucle |

  Trois courbes, nommées d'après le geste : **élan** (prise de vitesse, ce qui quitte l'écran), **impulsion** (départ et arrivée marqués, ce qui se déplace d'un point à un autre), **réception** (amorti, ce qui arrive ; courbe par défaut). Aucune courbe ne dépasse sa cible : pas de rebond. La cascade avance de 34 ms par élément. Dans un composant : `duration-(--duration-enter)`, `ease-reception`, ou `motion.duration.*` en JavaScript.
- **Écrans de travail.** Les lignes de l'en-tête se tracent à l'arrivée ; l'onglet actif glisse ; les compteurs défilent ; feuilles, menus, dialogues et messages entrent en montant de quelques pixels (260 ms) et sortent plus vite (150 ms) ; une carte de séance s'ouvre en écran de séance ; le bandeau piste reste en place d'une page à l'autre. Entrées de 260 ms au plus, cascade limitée à six éléments. Pas d'apparition déclenchée par le défilement dans un écran de travail.
- **Site, connexion, onboarding, accueils, états vides.** Effets au défilement, athlètes animés, parallaxe légère des captures.
- **Grands moments.** La validation d’une séance faite, qui peut intégrer les records confirmés de cette séance ; un record ; la fin des premiers pas ; la fin d'une épreuve du jeu. Pas de rejeu après synchronisation ni dans l’historique. Une validation partielle ne déclenche pas la célébration. Pas de son.
- **Mouvement réduit.** `prefers-reduced-motion` coupe tout mouvement non essentiel, transitions de page comprises. Toute animation de la feuille de styles est déclarée sous `no-preference`, et un test le vérifie. Un filet en fin de `globals.css` ramène à zéro toute animation ou transition qu'un composant déclarerait quand même ; les parcours le contrôlent avec `expectNoMotion`. Le jeu reste jouable, sans tremblement, parallaxe ni confettis.
- **Une carte qui s'ouvre.** La carte de la séance du jour et la feuille de l'écran de séance portent le même nom (`sessionCardName`) : en touchant la carte, l'athlète la voit devenir la feuille, à la même place, puis le contenu la remplit. L'écran d'attente de la séance porte déjà cette feuille, sous ce nom : c'est ce qui relie les deux sans précharger la page.
- **Transitions de page.** D'une page à l'autre, le contenu se fond en 150 ms ; le bandeau piste et l'en-tête du site gardent leur place, seul leur contenu change ; l'onglet actif glisse jusqu'à la nouvelle rubrique en 200 ms. Pendant le chargement, l'écran d'attente porte le même bandeau, donc le bandeau ne quitte jamais l'écran. Changer de semaine, de mois ou de filtre n'est pas changer de page : aucun fondu. Une validation ou un rafraîchissement non plus. Tout passe par l'enveloppe `src/components/ui/view-transition.tsx` (`PageTransition`, `Stay`) et `route-transition.tsx` ; aucun écran n'appelle les View Transitions de React directement. Sans prise en charge par le navigateur, la page change d'un coup.
- **Technique.** CSS et View Transitions ; pas de bibliothèque d'animation sans décision explicite.

## Le jeu

« Tartan Meeting » vit sur le site : un aperçu jouable après la ligne d'arrivée de la page d'accueil (le saut en hauteur), le jeu complet sur `/jeu`. Au saut en hauteur, la barre monte à chaque hauteur franchie, l'appel, le franchissement et la réception passent au ralenti, et une barre franchie se fête (confettis, hauteur en grand). Le ralenti ne touche que l'image, jamais la simulation ni le journal des appuis ; en mouvement réduit, ni confettis ni montée animée. Il se joue au pouce, d'un seul geste (appuyer, tenir, relâcher), et au clavier. La scène est encre et piste, avec les athlètes du groupe ; l'affichage tête haute, les résultats et le classement sont en HTML, dans les composants partagés. Le jeu ne retarde jamais le chargement de la page d'accueil. Sur iOS et Android, aucune mention de prix n'y figure.

## Recette

Chaque écran passe par UI/UX Pro Max, Frontend Design et Impeccable quand ces compétences sont disponibles, en conservant le contexte produit. Les suggestions génériques de landing ou de styles décoratifs ne remplacent pas ces décisions.

Vérifier 390, 768 et 1440 px, clavier, zoom 200 %, mouvement réduit, contenus longs, 30/60/120 athlètes et barres fixes. Contraste texte 4,5:1, gros texte 3:1, contrôles/focus 3:1. Vérifier les portails, menus et retours d’erreur dans le bon thème. VoiceOver/TalkBack et appareils physiques restent des recettes distinctes des exports et tests automatisés.

## Interdits (exigence « aucun AI slop »)

Un écran qui contient l'un de ces travers n'est pas terminé.

- Dégradés, texte en dégradé, halos colorés.
- Verre dépoli et flou décoratif.
- Grilles de cartes identiques (icône + titre + texte), cartes imbriquées décoratives (exception fonctionnelle du constructeur décrite ci-dessus).
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
