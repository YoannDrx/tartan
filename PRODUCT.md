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
- un jeu d'athlétisme sur le site, « Tartan Meeting » : aperçu jouable sur la page d'accueil, jeu complet sur `/jeu`, classement public avec pseudo et sans compte. Le disque y figure comme épreuve de jeu et comme illustration ; cela n'ouvre pas les lancers dans le produit.

Les animations sont autorisées partout, écrans de travail compris, sous les règles de `DESIGN.md`. Le bonhomme devient un groupe de six athlètes, un par épreuve. Le déroulé est dans `docs/plans/web.md` et `docs/plans/direction-artistique.md`.

## Décision de finalisation du 13 novembre 2026

Cette décision remplace l'ordre d'ouverture du 11 novembre et le caractère non bloquant de la bêta IA du 7 novembre. Avant la vente web/PWA : constructeur à circuits et supersets (deux niveaux de répétition au maximum), banque de 150 exercices distincts avec guides et visuels contrôlés, planificateur avec deux modes (« Mettre en forme ma séance », « Proposer une séance ») et résolution des exercices inconnus, vidéos déposées par les athlètes comme par les coachs. L'IA ne publie jamais seule et une création d'exercice reste privée à l'espace jusqu'à une éventuelle décision éditoriale distincte.

Les vidéos athlètes sont privées à l'athlète et aux coachs habilités ; le partage au groupe est volontaire et révocable. Les guides sont accessibles depuis la séance attribuée. Les illustrations fixes précèdent les animations techniques et les futures vidéos maison. Les offres et quotas restent inchangés, même avec Mux à la demande.

La vente web précède les stores ; les bêtas natives sur invitation suivent la mise à niveau et la recette physique. Android utilise un compte organisation, sans repli automatique vers un compte personnel. Adultes en France, sans messagerie générale, montres, mineurs ni bibliothèque communautaire publique. Le déroulé et les critères de fin sont dans `docs/plans/web.md`, l'état des preuves et les réserves dans `docs/ETAT.md`.

## Offres

Découverte (gratuite), Coach et Club. Les prix et les plafonds ont une seule source, `packages/domain/src/plans.ts` ; le tableau lisible est dans `docs/plans/commercialisation.md`. Les athlètes ne paient jamais.

## Utilisateurs

- Coach principal : terrain et ordinateur. Créer vite, attribuer finement, voir qui a fait quoi, analyser les gestes techniques.
- Coach adjoint / préparateur physique : gère ses séances, voit les retours.
- Athlète adulte : vient au club ou s'entraîne seul. Savoir quoi faire, valider sans effort.
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

- V2 : parents et mineurs, dessin et comparaison vidéo, statistiques de saut, planification de saison, bilan du matin, biométrie, PDF, tablettes, anglais.
- V3 : messagerie, lancers, demi-fond, montres, bibliothèque communautaire, commentaire vocal.
