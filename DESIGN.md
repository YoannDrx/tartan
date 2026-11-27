# Tartan — design system

Lu à chaque session de design. Source produit : `PRODUCT.md` ; état effectivement livré : `docs/ETAT.md` ; déroulé de la refonte : `docs/plans/direction-artistique.md`.

**Décision du fondateur du 11 novembre 2026.** La direction artistique « Le stade » s'applique partout : les lignes blanches de la piste, droites et courbes, et un groupe de six athlètes reviennent d'un écran à l'autre. Les animations sont autorisées partout, écrans de travail compris, car la qualité se joue dans les détails. Cette décision remplace les règles « un seul grand moment animé » et « pas d'animation d'apparition ». Le site a accueilli un jeu, « Tartan Meeting », retiré le 23 novembre 2026.

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

Le site, la connexion, l'onboarding, les accueils et les états vides portent les aplats, les athlètes et les effets au défilement, avec une représentation équilibrée de la préparation physique. Le parcours présenté est « préparer → individualiser → réaliser → progresser ». Tout écran présenté sur le site est une vraie capture du produit, prise sur des données fictives (personnes et résultats inventés, provenance tenue dans `images/provenance.json`) ; aucune maquette recomposée. Depuis l'ouverture du 23 novembre 2026, le site n'affiche plus de légende « capture fictive » ni aucune mention de bêta ou de pilote (décision du fondateur).

Le site ouvre sur le film piloté par le défilement, qui raconte ce que l’athlète y gagne (voir ce qui arrive, savoir ce qu’il travaille, savoir sur quoi s’appliquer). Il laisse le titre, la promesse et le bouton visibles dès l'ouverture, et reste court : 7,5 hauteurs d'écran sur téléphone, 10 sur ordinateur (décision du 12 novembre 2026). Depuis le 23 novembre 2026 (décision du fondateur), seul le saut en hauteur répond au défilement : Noé prend son élan pour « voir ce qui arrive », s'appuie sur la planche pour « savoir ce qu'il travaille », franchit la barre pour « savoir sur quoi s'appliquer », puis tombe dans le tapis à la validation ; chaque promesse change le monde de couleur, franchement. Les haies et la perche ne sont plus dans le film. Viennent ensuite deux sections de captures, l'une du côté du coach (sur un ordinateur portable dessiné en CSS), l'autre du côté de l'athlète (sur un téléphone) : un onglet par écran, la capture dans son appareil, puis ce qu'elle apporte. Les appareils sont dessinés par `src/features/landing/device-frame.tsx` dans les encres du design system, sans marque ni image de fabricant ; la capture reste brute. Tout le contenu court ensuite le long d’une seule piste : les virages se touchent et aucune section ne s’intercale entre eux avant la ligne d’arrivée. Les questions fréquentes (six questions du centre d'aide, reprises mot pour mot) et l'appel final viennent après la ligne d'arrivée. Sur téléphone, une capture précède toujours le texte qui la commente, en une colonne ; les tarifs se lisent en une carte par offre, le tableau complet replié sous « Tout comparer ».

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

## Logo

**Décision du fondateur du 17 novembre 2026.** La marque est le « T des couloirs » : l'initiale de Tartan tracée par deux couloirs parallèles qui tournent ensemble, posée sur une ligne d'arrivée citron. Elle remplace le carré aux cinq lignes de couloir, illisible à 16 px.

- **Source unique.** `scripts/build-logo.mjs` dessine la marque et produit tous les fichiers : onglet, écran d'accueil, PWA, icône masquable, iOS (claire, sombre, teintée), Android (adaptative, à thème), notification, écran de lancement, logotype, e-mail, image de partage. On ne retouche jamais un fichier à la main : on change le script, puis `node scripts/build-logo.mjs`. Un test vérifie la présence et les dimensions de chaque fichier.
- **Formes.** Dans un carré de 160 : une barre haute, deux crochets qui descendent, séparés par une ligne de 8 ; les couloirs font 18,4 d'épaisseur. La ligne d'arrivée citron ferme le pied de la lettre. Sous 32 px, la ligne entre les couloirs disparaît : la lettre est pleine (`icon-small.svg`, onglet, notification).
- **Couleurs.** La marque est blanche avec la ligne d'arrivée citron, sur la piste. Variantes permises : sur l'encre (mêmes couleurs), en silhouette d'une seule couleur (notification, icône à thème, icône teintée). Posée directement sur la piste, sans carré, elle garde le blanc et le citron : c'est le cas de l'en-tête de l'application et des e-mails.
- **Logotype.** Le T des couloirs forme la première lettre, suivi de « artan » en Barlow Condensed Bold. Dans un emplacement carré ou compact, utiliser le T seul. Texte encre sur clair, blanc sur la piste et sur l'encre.
- **Accueil connecté** (décision du fondateur du 27 novembre 2026). La marque se lit « Tartan Coach » ou « Tartan Athlète » : le rôle est écrit comme « artan », même police, même hauteur, son initiale dessinée en couloirs comme le T (le C en virage de piste, le A en deux arches carrées sur une barre citron). `scripts/build-logo.mjs` en tire les masques `role-coach-*.svg` et `role-athlete-*.svg`, que `.role-wordmark-*` peint comme `.wordmark`, et les PNG de l'app native. Sur téléphone (web), le T seul précède le rôle. Le nom de l'espace se lit dessous, en petit. L'en-tête tient sur une seule ligne, 8 px de marge en haut et en bas, l'avatar du compte fait 44 px (48 sur le natif). Un seul espace : la marque ramène à l'accueil. Plusieurs : elle ouvre la liste des espaces (menu sur le web, feuille sur le natif), une carte par espace avec son initiale, son nom, son rôle et une coche ; le choix mène droit à l'accueil du rôle, sans passer par une redirection. Jamais de `<select>` natif pour changer d'espace.
- **Le mot « Tartan »** (décision du fondateur du 23 novembre 2026). Sur le web, dans les applications, les e-mails et chez les prestataires, la marque, sans carré, tient lieu de T : à la hauteur des capitales, le pied de la ligne d'arrivée sur la ligne de base, puis « artan » à la distance qui sépare ses lettres. `scripts/build-logo.mjs` en tire deux masques (`wordmark-letters.svg`, `wordmark-line.svg`), que `.wordmark` peint dans la couleur du texte de la page : ligne d'arrivée citron sur la piste, le couloir et l'encre, d'une seule couleur sur un fond clair. Les lecteurs d'écran lisent « Tartan ».
- **Zone de protection.** Autour de l'icône, un quart de sa largeur reste vide. Dans une icône masquée (Android, PWA), la marque tient dans le cercle central.
- **Tailles minimales.** 16 px pour l'icône (forme pleine), 24 px de haut pour le logotype.
- **Interdits.** Pas d'autre couleur de fond que la piste, l'encre ou une silhouette. Pas de contour, d'ombre, de dégradé ni d'inclinaison. Pas de marque redessinée dans un composant : on prend les fichiers de `public/brand`. Pas de texte ajouté dans l'icône.

Les icônes natives changent avec le prochain binaire : une mise à jour à distance ne les remplace pas.

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

Les mondes historiques Piste, Couloir, Craie, Soleil et Nuit restent des palettes expressives ; ils ne dictent plus la couleur des écrans de travail. La navigation quotidienne est sur la piste, avec sélection citron et libellé explicite. Les e-mails suivent le mélange Tartan (décision du fondateur du 13 novembre 2026) : la piste en fond, le logo complet, les deux lignes blanches du couloir, le message sur une carte encre au texte blanc, l'action en citron au texte encre, les liens en citron. Une ligne blanche d'arrivée sépare le message du pied de page, posé sur la piste, en blanc, signé « Yodev, entreprise individuelle ». Aucune police chargée chez un tiers : les titres prennent Barlow Condensed si la messagerie l'a, sinon une capitale étroite. Un encadré (échéance, montant) est une encre relevée bordée de citron. Chaque famille d'e-mails porte l'athlète qui lui correspond, en image fixe.

## Typographie et rythme

Barlow pour le texte ; Barlow Condensed pour les titres et chiffres. Titres de travail courts et alignés à gauche, sans mot isolé au marqueur. Le marqueur peut rester sur les titres expressifs du site et de l’accueil.

Grille de 4 px ; espacements de 4 à 64 px. Marge latérale mobile 16 px, desktop 24 px. Rayons cohérents : boutons 14 px, cartes 20 px ; pas de carte dans une carte décorative. Exception décidée le 13 novembre : les cartes du constructeur représentent la structure réelle d'un circuit ou superset, avec deux niveaux de groupes répétés au maximum. Les couleurs sémantiques de préparation, force, vitesse/pliométrie et récupération passent par les jetons ; libellés et structure restent compréhensibles sans couleur. Le contenant « à répéter » montre les tours et les récupérations, sans bordure colorée épaisse à gauche. Cibles tactiles de 44 × 44 px. Aplats et bordures plutôt qu’ombres, sauf éléments flottants.

La couleur des séances et catégories sert la lecture du calendrier ; une spécialité ne bénéficie pas systématiquement d’un poids visuel supérieur. Les volumes et intensités conservent leurs unités et leur couverture de données.

## Composants et parcours

- Une action principale explicite par étape ; publication principale, brouillon secondaire, options avancées regroupées.
- Boutons secondaires sobres, contours et focus visibles sur leur surface réelle.
- Champs avec libellé permanent, erreur proche et annoncée, clavier suivant le thème ; les valeurs ne disparaissent pas sur une erreur.
- Entrée (connexion, création de compte, invitation) : l'adresse d'abord, puis deux chemins de même taille, sans mode caché : le mot de passe en action principale, le lien reçu par e-mail juste dessous. Un champ de mot de passe se relit d'un bouton avant l'envoi. Après l'envoi d'un lien, l'écran d'attente rappelle l'adresse, propose le renvoi et le changement d'adresse, et dit quoi faire si rien n'arrive. Aucun message ne dit si un compte existe.
- Cartes/listes de séance : titre, date, destinataires, état et catégorie avant les métadonnées secondaires.
- Contexte groupe/athlète/semaine conservé lors d’une consultation et d’un retour.
- Graphiques accompagnés d’une synthèse et d’un tableau ; aucun résultat manquant présenté comme mesuré.
- Installation proposée au bon moment, refermable ; aucune action cachée sous les barres fixes.
- Vidéo générale : « Vidéos » et « Analyse technique ». Barre, hauteur et phases techniques de saut seulement dans le contexte hauteur.
- Analyse vidéo en plein écran : l'éditeur (remarques, tracés, commentaires) reste à portée. En paysage et sur écran large, un panneau à droite de l'image, repliable en rail et élargissable ; en portrait, une feuille en bas à trois hauteurs (repliée, moitié, entière), réglable par la poignée ou par deux boutons. Écrire une remarque ramène la feuille à moitié : l'image commentée n'est jamais masquée. Hors plein écran, sous 1024 px, l'image reste collée en haut. Raccourcis : espace, flèches, F, M, listés dans l'aide de l'écran ; un tracé se pose aussi au clavier.

## Le groupe

Six athlètes aux prénoms fictifs, un seul squelette et un seul trait : membres à bouts ronds, aplats, mains, trois expressions (neutre, effort, joie), dossard. Une seule morphologie, pour que les appuis et les prises d'accessoire restent justes ; les teints, les coiffures et les tenues varient, femmes et hommes. Source unique : le paquet `packages/mascot` (créé par le lot B2), partagé par le site, l'application et le mobile. Chaque teint est vérifié contre la piste, l'encre et la craie.

| Couloir | Prénom | Épreuve | Accessoire | Rubrique associée | Coiffure, teint |
| --- | --- | --- | --- | --- | --- |
| 1 | Inès | Haies | Haie | Calendrier | Queue de cheval, clair |
| 2 | Malo | Perche | Perche qui fléchit, barre, tapis | Progrès | Afro, profond |
| 3 | Awa | Triple saut | Planche, sable | Constructeur et séances | Chignon, hâlé |
| 4 | Mehdi | Disque | Disque, cercle, secteur | Exercices | Coupe courte, hâlé |
| 5 | Lila | Longueur | Planche, sable | Suivi | Queue de cheval, pêche |
| 6 | Noé | Hauteur | Barre, tapis | Vidéos | Coupe courte, pêche. Le personnage d'origine |

Le dossard porte le numéro de couloir et reste lisible quand le corps se retourne. Chaque épreuve a son geste complet, de la mise en place à la réussite (`@tartan/mascot/events`) : un film ou un écran choisit l'instant, rien ne dépend d'une horloge. Le visage suit le geste : neutre avant, à l'effort pendant, joyeux une fois réussi.

Les sautoirs de hauteur et de perche ont les couleurs des tapis de stade : corps bleu, dessus rouge, liseré blanc au bord du dessus, qui le détache de la piste (`film.matBlue`, `film.matRed`).

Les couleurs du groupe vivent dans `packages/design-tokens/src/athletes.ts`. Deux aplats voisins (un teint et son fond, un bras et un maillot, des cheveux et un visage) sont séparés d'au moins 0,12 dans l'espace Oklab, sur la piste, l'encre et la craie, et sur les deux autres mondes que traverse le film (le bleu du couloir, le citron de la validation) : un contraste de luminance ne suffit pas, un brun et le rouge de la piste ont la même clarté. Conséquences assumées : aucun cheveu n'est noir, il se perdrait sur l'encre ; les cheveux de Malo sont blonds, pour se détacher de son teint ; un maillot blanc ou encre change de couleur sur le fond qui l'effacerait.

La planche de contrôle `/admin/mascotte` montre le groupe sur ses cinq fonds, les visages, les poses, les six gestes et les motifs. Le fondateur a décidé le 12 novembre 2026 d'avancer sans attendre sa revue de la planche : les athlètes sont déjà sur la page d'accueil (le film du saut en hauteur), la page introuvable et la page hors ligne. Une correction issue de la revue se fait à un seul endroit par sujet : les prénoms dans `packages/i18n`, les couleurs dans `packages/design-tokens`, les gestes dans `packages/mascot`.

Les guides d'exercice ont leur geste animé (`@tartan/mascot/v2/registry`, les 173 fiches du catalogue) : un athlète du groupe, de profil, sur l'encre, par famille (Mehdi en musculation, Malo en haltérophilie, Noé en pliométrie, Inès en course, Awa en gainage, plots et escaliers, Lila en échauffement et mobilité). Le geste enchaîne une position par ligne du guide (installation, puis chaque étape) et tourne en boucle ; une pastille par ligne montre où il en est et l'arrête sur la position choisie, dont la ligne s'affiche dessous. En mouvement réduit, une frise des positions remplace la lecture. Les gestes qui avancent (course, bonds, plots) gardent l'athlète au centre : la piste défile. La barre se voit par son bout, un disque dans la main ; devant le visage, il passe derrière la tête. Les exercices qui se lisent de face (élévations latérales, pas chassés, gainage latéral, jumping jacks…) ont leur vue de face : épaules et hanches écartées, les deux yeux au milieu du visage, le dossard centré ; couché sur le côté, la tête est à gauche ; allongé sur le ventre, le corps est vu de dos, d'en haut. L'atelier `/admin/mouvements` montre les gestes par famille ; une famille validée par le fondateur affiche « Illustration originale Tartan », sinon « Illustration de travail ». Le geste est lu d'après la fiche commune au moment de l'affichage : une séance déjà publiée le reçoit.

Un seul moteur anime ces gestes (`@tartan/mascot/v2`), depuis le retrait de l'ancien le 22 novembre 2026 : un corps plus fin, en trois dimensions, et deux vues pour une seule description. Un geste est écrit à la main, ou relevé d'un geste de l'ancien moteur (ses angles et son rythme, rejoués par le nouveau corps, `v2/lift-v1.ts`) ; les données de l'ancien moteur (`exercises/`) restent tant qu'un geste en est relevé, mais l'ancien moteur ne dessine plus rien. Aucun geste n'a d'exception : un geste relevé qui viole une contrainte se réécrit à la main, le test du registre le vérifie. Un sélecteur « Profil / Face » (« Dessus » pour un geste au sol) change de vue sans arrêter la lecture, au clavier comme au doigt, sur des cibles de 44 px ; les pastilles et la ligne du guide restent ; en mouvement réduit, la frise suit la vue choisie. La barre est tenue à deux mains ; de profil, les disques passent derrière l'athlète et la tête devant le bras qui la croise. Sur le web, la lecture met à jour les tracés sans rendu de page et s'arrête hors de l'écran ; sur mobile, le rendu est limité à trente images par seconde. Deux niveaux, affichés dans l'atelier avec les deux vues côte à côte : écrit à la main, relevé. Les gestes du nouveau moteur sont la seule série de relecture (« famille:v2 ») : une famille validée sur l'ancien moteur ne les couvre pas. L'app native consulte encore `motionEngine` et garde sa lecture de l'ancien moteur, que plus aucun geste n'emprunte : elle la retirera à son tour.

Un athlète accompagne un accueil, un état vide, un chargement long, une erreur, une célébration, un e-mail. Il ne remplace jamais une information ou une action, et ne s'interpose pas entre l'utilisateur et sa tâche. Dans un écran de travail, il se tient sur un bout de piste (`TrackTile`) : le rouge et la ligne blanche ne changent pas avec le thème, donc sa tenue reste lisible sur une carte claire comme sur une carte encre. Chaque état vide porte l'athlète de sa rubrique (`src/lib/rubric-athlete.ts`) ; les rubriques que la table ne nomme pas prennent celui de la rubrique la plus proche.

Les pages d'entrée posent le groupe sur une ligne de piste (`src/features/shell/start-scene.tsx`), à droite du formulaire sur ordinateur, à la place des virages. La connexion aligne trois athlètes du groupe (Inès, Malo, Noé), aussi sous le formulaire sur téléphone. La création de l'espace montre Inès sur ordinateur seulement, le formulaire gardant tout l'écran du téléphone : sa pose suit le temps affiché (à vos marques, elle se place ; prêts, elle se concentre ; partez, elle s'élance), lue en CSS sur l'attribut `data-step` du formulaire.

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
- **Glisser-déposer.** Une seule mécanique (`src/lib/use-pointer-drag.ts`), au pointeur comme au doigt, pour le constructeur et le planning. Pendant le geste : la source reste à sa place, atténuée, dans un cadre en pointillés ; un aperçu suit le pointeur, soulevé par un contour d'action et l'ombre douce des éléments flottants ; la destination s'éclaire d'un fond teinté et d'un contour en pointillés ; un trait d'action montre le rang d'arrivée ; une destination interdite le dit par une icône et des mots. Au dépôt, l'élément rejoint sa place avec la réception en 260 ms, la donnée change tout de suite, et un refus du serveur le ramène avec un message. Surbrillance et pointillés sont des états : ils restent en mouvement réduit, seul le trajet disparaît. Une carte entière se saisit par appui long au doigt, pour ne pas voler le défilement. Une alternative sans glisser existe toujours à côté (boutons, menu).
- **Site, connexion, onboarding, accueils, états vides.** Effets au défilement, athlètes animés, parallaxe légère des captures.
- **Grands moments.** La validation d’une séance faite, qui peut intégrer les records confirmés de cette séance ; un record ; la fin des premiers pas. Pas de rejeu après synchronisation ni dans l’historique. Une validation partielle ne déclenche pas la célébration. La célébration joue le retour sonore « success » (voir ci-dessous).
- **Son et toucher** (décision du fondateur, 27 novembre 2026 : l'app ne doit plus être muette). Un vocabulaire unique de retours, défini dans `packages/design-tokens/src/feedback.ts` : `tap` (pression d'un bouton), `select` (onglet, pastille, choix), `toggle` (case, interrupteur), `setDone` (série cochée), `success` (séance validée, record), `restEnd` (fin de récupération), `error` (refus, message d'erreur). Chacun a un son court synthétisé par Tartan (aucun son de tiers), une vibration sur téléphone (web) et un retour haptique (app native). Règles : le retour suit le geste sans jamais le retarder ; sons activés par défaut, coupables par appareil dans Réglages, Apparence ; jamais de son pendant une vidéo, une dictée ou l'écoute d'un vocal ; sur iOS, le mode silencieux les fait taire et la musique de l'utilisateur continue. Web : un bouton (`Button`, `IconButton`) joue `tap` par défaut, tout élément le déclare par `data-feedback`, et `toast.error` joue `error` (`src/lib/feedback.ts`). Natif : `Button`, `IconButton`, `Chip` et la barre d'onglets jouent leur retour (`src/lib/feedback.ts`, fichiers produits par `scripts/build-sounds.ts`). Le mouvement réduit coupe les animations, pas les sons. Une pression se voit aussi : le bouton s'enfonce un instant (80 ms, sauf en mouvement réduit).
- **Mouvement réduit.** `prefers-reduced-motion` coupe tout mouvement non essentiel, transitions de page comprises. Toute animation de la feuille de styles est déclarée sous `no-preference`, et un test le vérifie. Un filet en fin de `globals.css` ramène à zéro toute animation ou transition qu'un composant déclarerait quand même ; les parcours le contrôlent avec `expectNoMotion`.
- **Une carte qui s'ouvre.** La carte de la séance du jour et la feuille de l'écran de séance portent le même nom (`sessionCardName`) : en touchant la carte, l'athlète la voit devenir la feuille, à la même place, puis le contenu la remplit. L'écran d'attente de la séance porte déjà cette feuille, sous ce nom : c'est ce qui relie les deux sans précharger la page.
- **Transitions de page.** D'une page à l'autre, le contenu se fond en 150 ms ; le bandeau piste et l'en-tête du site gardent leur place, seul leur contenu change ; l'onglet actif glisse jusqu'à la nouvelle rubrique en 200 ms. Pendant le chargement, l'écran d'attente porte le même bandeau, donc le bandeau ne quitte jamais l'écran. Changer de semaine, de mois ou de filtre n'est pas changer de page : aucun fondu. Une validation ou un rafraîchissement non plus. Tout passe par l'enveloppe `src/components/ui/view-transition.tsx` (`PageTransition`, `Stay`) et `route-transition.tsx` ; aucun écran n'appelle les View Transitions de React directement. Sans prise en charge par le navigateur, la page change d'un coup.
- **Technique.** Web : CSS et View Transitions. App native : `react-native-reanimated` est autorisé pour les transitions et les micro-animations (décision du 27 novembre 2026), avec les jetons de `motion.ts`. Aucune autre bibliothèque d'animation sans décision explicite.

## Le jeu (retiré)

Le jeu du site, « Tartan Meeting », est retiré depuis le 23 novembre 2026, à la demande du fondateur. Son ancienne adresse mène à l'accueil. Le groupe et ses épreuves animées restent.

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
