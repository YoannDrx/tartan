# Tartan — produit

**register: product**

Tartan est l'app de préparation physique du coach et de son groupe, ancrée dans l'athlétisme : planifier, individualiser, suivre et comprendre la progression. Musculation, pliométrie, technique de course, plots, escaliers et mobilité sont des usages de premier plan. Le saut en hauteur reste une spécialité disponible ; ses champs et son vocabulaire ne s'imposent pas aux autres disciplines.

**Vision.** Le carnet d'entraînement partagé du coach et de son groupe : chacun sait ce qu'il a à faire, le coach sait ce qui a réellement été fait, et l'historique aide à comprendre la progression.

**Ce que la V1 doit réussir.** Remplacer les SMS. Savoir qui a fait quoi : l'athlète valide en moins de 10 secondes, le coach voit une grille athlètes × séances. Analyser un geste athlétique : filmer, revoir au ralenti, commenter sur la timeline, partager.

**Le principal risque.** Les athlètes ne rempliront rien si valider demande plus de quelques secondes. Chaque décision côté athlète se juge à l'aune de ce critère.

**Décision V1.1 du 7 novembre 2026.** Le fondateur autorise explicitement l'extension à la saisie des séries réalisées, aux références de force liées aux exercices, aux records, aux phases partagées et aux statistiques avec provenance. La saisie détaillée reste facultative : une validation simple reste possible, sans transformer une prescription en réalisation supposée. Le planificateur IA prépare des brouillons à relire, sans publication autonome ; sa bêta ne conditionne pas l'ouverture commerciale des autres fonctions. Ce qui est effectivement disponible se lit dans `docs/ETAT.md`.

**Décision d'ouverture du 8 novembre 2026.** Le fondateur retient le positionnement « préparation physique, l'app du coach et de son groupe », avec l'athlétisme en phrase secondaire et en référencement. À l'ouverture, progression et phases sont actives pour tous les espaces ; le planificateur IA sort en bêta sur les offres payantes, sous seuils de qualité. La vente s'ouvre d'abord sur le web et la PWA, iOS et Android suivent sans la retarder. Ajouts autorisés : vues Liste et Mois, centre de notifications, notes de version, console d'administration complète avec remboursements, lien vidéo-exercice.

**Décision du 11 novembre 2026.** Le fondateur fixe l'ordre : vendre la web app d'abord (paiement, suite d'e-mails complète, onboarding du coach et de l'athlète), refondre ensuite la direction artistique partout, puis livrer le jeu. Les stores iOS et Android suivent. Ajouts autorisés au périmètre :

- un centre d'aide, avec une aide courte par écran et un contact visible dans l'application ;
- l'absence signalée par l'athlète, en un geste, sans donnée de santé ;
- la carte de record à partager ;
- la série de régularité de l'athlète ;
- ~~un jeu d'athlétisme sur le site, « Tartan Meeting »~~ : retiré le 23 novembre 2026 (voir plus bas). Le disque reste une illustration du groupe ; cela n'ouvre pas les lancers dans le produit.

Les animations sont autorisées partout, écrans de travail compris, sous les règles de `DESIGN.md`. Le bonhomme devient un groupe de six athlètes, un par épreuve. Le déroulé est dans `docs/plans/web.md` et `docs/plans/direction-artistique.md`.

## Décision de finalisation du 13 novembre 2026

Cette décision remplace l'ordre d'ouverture du 11 novembre et le caractère non bloquant de la bêta IA du 7 novembre. Avant la vente web/PWA : constructeur à circuits et supersets (deux niveaux de répétition au maximum), banque de 150 exercices distincts avec guides et visuels contrôlés, planificateur avec deux modes (« Mettre en forme ma séance », « Proposer une séance ») et résolution des exercices inconnus, vidéos déposées par les athlètes comme par les coachs. L'IA ne publie jamais seule et une création d'exercice reste privée à l'espace jusqu'à une éventuelle décision éditoriale distincte.

Les vidéos athlètes sont privées à l'athlète et aux coachs habilités ; le partage au groupe est volontaire et révocable. Les guides sont accessibles depuis la séance attribuée. Les illustrations fixes précèdent les animations techniques et les futures vidéos maison. Les offres et quotas restent inchangés, même avec Mux à la demande.

La vente web précède les stores ; les bêtas natives sur invitation suivent la mise à niveau et la recette physique. Android utilise un compte organisation, sans repli automatique vers un compte personnel. Adultes en France, sans messagerie générale, montres, mineurs ni bibliothèque communautaire publique. Le déroulé et les critères de fin sont dans `docs/plans/web.md`, l'état des preuves et les réserves dans `docs/ETAT.md`.

## Accueil connecté et entraînement personnel

Le bandeau affiche « Tartan Coach » pour les encadrants et « Tartan Athlète » pour les pratiquants. Le club figure en second. Les personnes qui appartiennent à plusieurs clubs peuvent les ouvrir depuis « Mes clubs » dans les réglages et choisir leur accueil habituel.

Un athlète du club retrouve dans sa journée et son calendrier les séances prescrites et ses propres séances. Son planificateur utilise son carnet, ses quotas et ses accords. Il consulte les guides d'exercices et les vidéos auxquelles il a accès. Les propositions, mesures et vidéos personnelles restent dans le carnet. Le partage volontaire et révocable de l'historique détermine les éléments accessibles à son coach.

## Décision du 14 novembre 2026

Après l'audit du 14 novembre, le fondateur confirme :

- **Ouverture sans médiateur de la consommation**, pour l'instant. Le risque est accepté par le fondateur ; les CGV seront complétées dès l'adhésion.
- **Accords de traitement** acceptés chez tous les prestataires. **Avis du juriste** obtenu sur l'ensemble du dossier, hébergement de données de santé, Mux aux États-Unis et partage des vidéos au groupe compris.
- **Fiscalité** : micro-entreprise non assujettie à la TVA (article 293 B du CGI), mention déjà portée sur les factures ; Stripe Tax reste coupé.
- **Guides d'exercices** : ils portent la mention « consignes indicatives, le coach reste responsable de la prescription ».
- **Tracés sur vidéo** (ligne, flèche, angle) : ils entrent dans le périmètre de cette version. La comparaison de deux vidéos reste en V2.
- **Quota vidéo par athlète** : chaque athlète envoie jusqu'à 8 vidéos par mois en Découverte et 20 en Coach et Club ; ces envois ne comptent pas dans le quota de l'espace (`ATHLETE_VIDEOS_PER_MONTH`, `packages/domain/src/plans.ts`).
- **Constructeur** : la maquette du 14 novembre (cartes imbriquées colorées par famille, ajout à l'emplacement exact, ordre de l'athlète) est validée.

## Décision du 16 novembre 2026

Le fondateur fixe la priorité : **la web app d'abord, entièrement fonctionnelle**, avant de reprendre les bêtas iOS et Android. Il ajoute au périmètre :

- **Connexion par mot de passe.** Coach et athlète peuvent définir leur propre mot de passe, à l'inscription, après une invitation ou dans les réglages. Ils se reconnectent ensuite au choix par le lien reçu par e-mail ou par ce mot de passe.
- **Listes d'exercices du coach.** La bibliothèque commune reste le fonds partagé. Chaque coach peut :
  - mettre des fiches en favoris ;
  - créer ses propres listes, invisibles des autres utilisateurs ;
  - y ranger des fiches communes ou des fiches qu'il crée.

  Ce ne sont pas des bibliothèques communautaires publiques, qui restent en V3. Les fiches deviennent plus claires et plus concises.

- **Vidéo en plein écran** avec l'éditeur de remarques, de tracés et de commentaires toujours à portée, sur ordinateur comme sur téléphone.
- **Planning.** Le glisser-déposer donne un retour visuel et animé : colonne survolée, emplacement, dépôt.
- **Gestes des exercices.** Placements justes et vraie dynamique, par exemple l'accélération en haltérophilie, avec un personnage plus fin. Une même morphologie reste partagée par tout le produit.
- **Nouveau logo.** Plus fort et reconnaissable en petit : onglet du navigateur, App Store.

Le déroulé est dans [docs/plans/audit-et-refonte.md](docs/plans/audit-et-refonte.md).

## Décision du 17 novembre 2026

Après le plan d'exécution de l'audit, le fondateur ajoute au périmètre :

- **Onboarding complet.** À l'inscription, le coach est guidé pas à pas : présentation de chaque fonction, étapes à faire, reprise possible. L'athlète qui rejoint un groupe reçoit lui aussi un accueil complet, qui ne retarde jamais sa séance.
- **Réglages refondus**, rangés en rubriques.
- **Photo de profil.** L'utilisateur envoie sa photo, la recadre, la zoome et la pivote avant de l'enregistrer, ou choisit un avatar : les athlètes du groupe ou une banque libre d'animaux.
- **Espace de démonstration** proposé au coach neuf, séparé de son espace et jetable.
- **Exercices.** Chaque fiche se voit de profil et de face, avec un moteur de gestes refait. Chaque fiche commune peut recevoir une vidéo déposée par Tartan.
- **Listes d'exercices.** Privées par défaut, avec un partage au choix vers les coachs du même espace.
- **Planificateur IA.** Il doit devenir réellement utilisable ; des appels réels sont autorisés pour le mesurer, 30 € au plus.

Le fondateur donne carte blanche sur le design et l'expérience : `DESIGN.md` évolue avec la refonte. La base de production n'étant pas utilisée, elle est vidée après sauvegarde, sauf le compte administrateur, et les essais en production se font avec ses deux adresses. Les constats de l'audit et l'ordre des lots sont dans [docs/plans/audit-et-refonte.md](docs/plans/audit-et-refonte.md#8-constats-de-laudit-17-novembre-2026).

## Décision du 21 novembre 2026

Le fondateur juge le planificateur IA peu performant : il ne comprend pas assez bien ce que le coach demande. Il décide :

- **Un seul champ.** Le coach écrit ou dicte ce qu'il veut. Le planificateur comprend seul s'il décrit sa séance, s'il donne un objectif, ou s'il mêle les deux, et dit ce qu'il a compris. Cela remplace les deux modes du 13 novembre.
- **Exercices.** Chaque mouvement cité est cherché dans toute la bibliothèque. Un rapprochement incertain est posé et signalé, sans bloquer la séance. Un exercice absent se crée en un geste, depuis la séance proposée comme depuis le constructeur.
- **Plus de « bêta ».** La mention est retirée sur preuve : un corpus neuf noté avec des seuils fixés d'avance (aucune date fausse, aucune charge inventée, 95 % de séances justes), puis un essai du fondateur sur la Preview.
- **Budget.** 40 € d'appels réels en plus des 30 € du 17 novembre. Le modèle se choisit à la mesure, dans la gamme courante d'OpenAI.

Ce qui ne change pas : le planificateur ne crée que des brouillons, n'invente ni date ni charge, et ne modifie jamais ce que le coach a dicté.

## Décision du 23 novembre 2026

À la demande du fondateur, le jeu d'athlétisme du site (« Tartan Meeting » : aperçu sur la page d'accueil, page du jeu, classement public et sa modération) est retiré du périmètre. Son ancienne adresse mène à l'accueil. Le groupe d'athlètes et ses épreuves animées restent (film d'accueil, cartes, e-mails, gestes des exercices).

Le même jour, le fondateur ajoute l'**athlète autonome** au périmètre (plan : [docs/plans/athlete-autonome.md](docs/plans/athlete-autonome.md)) :

- **S'inscrire sans coach.** Après la création du compte, un aiguillage propose trois chemins de même rang : « Je suis coach », « Je m'entraîne seul », « J'ai un lien d'invitation ». L'athlète qui s'entraîne seul ouvre un **espace personnel** dont il est l'unique membre : il y planifie et valide ses propres séances, avec le constructeur, le calendrier, les modèles et le planificateur, sans destinataires ; progrès, records, références de force, phases, vidéos, bibliothèque et listes y sont disponibles. Ni groupe, ni athlètes, ni annonces, ni abonnement.
- **Rejoindre un coach.** Il garde son espace personnel et rejoint le groupe du coach comme tout athlète. Il peut **partager s'il le veut** son historique (records, références de force, historique des séances), case par case, en lecture seule et révocable ; ses données de santé ne sont jamais partagées par ce chemin.
- **Gratuité avec quotas.** L'espace personnel est gratuit et jamais facturé, avec de petits quotas mensuels : 5 propositions du planificateur, 10 minutes de dictée, 4 vidéos. Aucun prix n'apparaît sur iOS et Android. Ses inscriptions ont leur propre réglage dans la console, ouvert par défaut, distinct de celui des coachs.

## Offres

Découverte (gratuite), Coach et Club. Les prix et les plafonds ont une seule source, `packages/domain/src/plans.ts` ; le tableau lisible est dans `docs/plans/commercialisation.md`. Les athlètes ne paient jamais : l'espace personnel de l'athlète autonome (offre « Personnel ») est gratuit, hors facturation.

## Utilisateurs

- Coach principal : terrain et ordinateur. Créer vite, attribuer finement, voir qui a fait quoi, analyser les gestes techniques.
- Coach adjoint / préparateur physique : gère ses séances, voit les retours.
- Athlète adulte : vient au club ou s'entraîne seul. Savoir quoi faire, valider sans effort.
- Athlète autonome : s'entraîne sans coach, dans son espace personnel. Planifier pour lui-même, valider, voir sa progression ; rejoindre un coach un jour sans rien perdre.
- V1 réservée aux majeurs, en France, sportifs compris (décision du 4 novembre 2026). Le parcours d'accord parental reste dans le code, dormant (`PARENTAL_FLOW_ENABLED`).

## Plateformes

- Web (Next.js, `apps/web`) : desktop coach pour planifier, version mobile pour ouvrir une invitation sans installation, site tartan.coach.
- iOS et Android (Expo, `apps/mobile`) : athlètes et coachs sur le terrain, caméra, notifications, hors ligne.

## Ton

Côté athlète : tutoiement, phrases courtes, encourageant sans infantiliser (« Séance validée, bien joué »). Côté coach : sobre et précis, vocabulaire du métier (RPE, 1RM, contacts au sol, appel, impulsion). Les messages importants sont signés du coach.

## Principes

10 secondes côté athlète. Le contexte avant la discussion (échanges sous une séance ou une vidéo, pas de chat). Mobile d'abord, desktop pour construire. Le coach reste la voix. Lisible sur le terrain. Pensé pour plusieurs. Respect des données.

## Hors périmètre

Tout ajout passe par une décision explicite du fondateur, consignée ici.

- V2 : parents et mineurs, comparaison de deux vidéos, statistiques de saut, planification de saison, bilan du matin, biométrie, PDF, tablettes, anglais.
- V3 : messagerie, lancers, demi-fond, montres, bibliothèque communautaire, commentaire vocal.
