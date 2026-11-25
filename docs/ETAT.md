# État du projet

Mis à jour le 23 novembre 2026. Toute PR qui change un état met ce fichier à jour.

Ce fichier est une photographie. L'historique des lots vit dans Git (`git log -p docs/ETAT.md`) et les passations dans [JOURNAL.md](JOURNAL.md).

## Illustrations, série pilote et atelier de relecture · 25 novembre 2026

Douze silhouettes détaillées ont une image et une vignette WebP versionnées, 272 Kio sur disque au total, environ 5,2 Mio pour 233 au même poids. Le coût monétaire par reprise reste à chiffrer. Texte, image et geste ont des validations séparées. Aucune validation humaine simulée. Deux tests de service et les parcours Playwright ordinateur et téléphone ont passé la validation puis la réouverture d’une image. Inventaire agrégé en lecture seule le 25 novembre : 197 fiches communes visibles, dont les 173 clés versionnées et 24 sans clé ni guide. Ces 24 figurent séparément dans l’atelier. Le pilote et les 60 nouvelles fiches attendent leur relecture sportive. Les 221 autres illustrations restent à produire.

**En une phrase.**
- Fait : le plan du 15 novembre est mené jusqu'au lot 4. Le constructeur est terminé sur le web et sur le mobile, Maestro tourne sur iOS et Android, et les 173 fiches ont un geste animé, de profil ou de face.
- Pas encore prouvé : l'IA n'est pas qualifiée, aucun vrai paiement n'a été fait et aucun téléphone physique n'a servi.
- Écarts relevés par le fondateur le 16 novembre : gestes imprécis, glisser-déposer du planning sans retour visuel, pas de connexion par mot de passe dans les réglages, pas de listes d'exercices, pas de plein écran vidéo, logo peu lisible.

**Plan en cours, depuis le 16 novembre.** Le web d'abord, à 100 %, puis iOS et Android, selon le brief [plans/audit-et-refonte.md](plans/audit-et-refonte.md).
- **Audit fait le 17 novembre** : 81 écrans balayés à trois largeurs sur données remplies, parcours rejoués, volume et performance mesurés. Sept défauts bloquent la vente, dix-sept gênent ([constats](plans/audit-et-refonte.md#8-constats-de-laudit-17-novembre-2026)).
- **Ordre des lots**, fixé par l'audit ([section 8.9](plans/audit-et-refonte.md#89-lots-dans-lordre-retenu)) : lot 0 (CI web seule), réglages en rubriques, glisser-déposer du planning, mot de passe, vidéo en plein écran, photo de profil et avatars, listes et fiches d'exercices, onboarding, planificateur, logo, gestes, corrections, recette web, parité mobile et bêtas.

## Avancement du plan d'audit et de refonte (au 18 novembre 2026)

Le plan a été mené par deux modèles de Claude, l'un après l'autre : **Claude Fable 5.2** du 17 novembre à la matinée du 18, jusqu'à la limite d'usage de ce modèle, puis **Claude Opus 5.5** à partir de la matinée du 18. La colonne « Mené par » dit qui a écrit le code ou la documentation du lot, et qui l'a fusionné quand ce n'est pas le même.

Niveaux : **codé**, **testé** automatiquement, **éprouvé** en production ou sur appareil réel. « En production » veut dire fusionné et servi par `app.tartan.coach`, pas joué par une vraie personne.

### Lots livrés

| Lot | PR | Niveau | Mené par |
| --- | --- | --- | --- |
| Audit complet (81 écrans, parcours, volume, performance) et ordre des lots | 157 | En production (documentation) | Fable |
| Lot 0 : Maestro seulement pour ce que l'app native embarque, textes propres au web (`@tartan/i18n/web`), port des parcours réglable, lien d'action du journal local | 158 | En production ; vérifié sur GitHub (une PR web saute Maestro) | Fable |
| Mesure du planificateur : jetons comptés, résumé par passage ; mesure de départ en appels réels (66, 61, 68 sur 80) | 160 | En production | Fable |
| A. Réglages en rubriques (constats B7, G16) | 161 | En production, testé ; pas joué avec un compte connecté | Fable |
| B. Glisser-déposer du planning (brief 4.2, constat G7) | 162 | En production, testé ; toucher sur téléphone réel non éprouvé | Fable |
| D. Vidéo en plein écran, raccourcis, tracés au clavier (brief 4.4) | 163 | En production, testé ; Safari iOS et Android réels non éprouvés | Codé par Fable ; fusionné par Opus |
| Logo « le T des couloirs » (brief 4.6), direction A choisie par le fondateur | 159 | En production pour le web ; les icônes natives arriveront avec le prochain binaire ; Maestro iOS a échoué deux fois sur des parcours différents avant de passer, attribué au simulateur | Codé par Fable ; Maestro diagnostiqué et fusionné par Opus |
| C. Connexion par mot de passe (brief 4.1, constats B2, G1, G12) | 164 | En production, testé (8 parcours qui suivent les vrais e-mails) ; aucune connexion réelle jouée | Codé par Fable ; ouvert, alerte GitGuardian traitée et fusionné par Opus |
| E. Photo de profil recadrée et avatars (groupe et animaux dessinés pour Tartan, constat G14) | 166 | En production, testé (parcours `avatar` contre un Blob simulé) ; ni Vercel Blob réel ni iPhone | Opus |
| Gestes : moteur v2, 173 fiches sur le nouveau moteur (77 écrites à la main, 96 relevées), lecteurs web et mobile avec bascule Profil et Face, atelier en deux vues | 167 | En production, testé (2 299 tests du paquet, parcours des guides) ; prototype validé par le fondateur le 17 novembre ; aucun geste regardé en mouvement par un humain | Moteur, relèvement et lecteurs par Fable ; écriture à la main par Opus |
| F. Listes et favoris d'exercices, fiche concise, bibliothèque et sélecteur allégés (brief 4.3, constats G3, G11) | 168 | En production, testé (droits des listes, parcours `exercise-lists` et `exercise-guides`) ; guides concis non relus par le fondateur | Opus |
| Gestes, morphologie partout : un seul corps dans le film, les cartes du groupe, les e-mails et le mobile ; mains et pieds sur leur objet ; vidéo de catalogue par fiche (`/admin/exercices`) | 169 | En production le 21 novembre, testé (2 903 tests du paquet, parcours `landing`, `mascot-board`, `catalog-video`) ; aucune vidéo de catalogue déposée | Opus ; fusionné par Fable |
| H. Planificateur IA, version du lot H : erreurs lisibles, sortie alignée sur le constructeur, contexte de « Proposer », réponse diffusée, écran en deux temps | 170 | En production le 21 novembre, testé contre le prestataire simulé ; mesuré le 21 novembre sur un corpus neuf : 13 séances justes sur 80, d'où la refonte | Opus ; fusionné par Fable |
| K1. Corrections de l'audit : filtres de `/videos` en feuille (G2), service worker limité aux fichiers qui existent (G5), nom de l'espace lisible dans l'en-tête à 390 px (G6), `/analyse` hiérarchisée (G9), message de publication qui dit qui reçoit la séance (G10) | 171 | En production le 21 novembre, testé (règles pures, service de publication, parcours `video-filters`, `training-analysis`, `shell`, `screen-matrix`) ; hors ligne réel non éprouvé | Opus ; fusionné par Fable |
| G. Onboarding complet du coach et de l'athlète (constats B1, B3, G15) : invitation dès la création de l'espace, « Ton tour de piste », carte « Pour démarrer », page `/premiers-pas`, repères de première visite, accueil de l'athlète qui ne retarde jamais sa séance, carte facultative après la première validation, état gardé en base (`OnboardingState`) | 172 | En production le 22 novembre, testé (suite Playwright entière le 19 novembre : 257 réussis, 0 échec ; validation de l'athlète mesurée à 0,8 s ; parcours rejoués le 21 novembre après fusion de `main`) ; jamais joué par une vraie personne | Opus ; ouvert par Fable |
| Espace de démonstration : un coach neuf ouvre depuis `/premiers-pas` un espace séparé et jetable, rempli de 8 athlètes fictifs sans compte, de séances passées et à venir, de validations et de phases ; bandeau permanent, suppression en un geste, purge à 14 jours | 173 | En production le 22 novembre, testé (20 tests d'exclusion, un par service : planificateur, vidéo, invitations, notifications, e-mails, cron, facturation, statistiques, mesure d'audience ; parcours `demo-space` sur build de production) ; jamais ouvert par un vrai coach | Opus ; ouvert par Fable |
| K2. Corrections de l'audit : `/suivi` ne déborde plus à 390 px (B6) et un balayage sur espace rempli entre en CI (`filled-sweep.spec.ts`, `demo:fill --groupe`) ; grands groupes par tranches de 30, avec recherche et en-têtes collants (G4) ; pastilles à 44 px et cases dessinées à 24 px (G8) ; athlète de la rubrique dans les états vides de `/phases` et `/progres` (G13) ; lien « Aller au contenu » | 174 | En production le 22 novembre, testé (parcours `filled-sweep` à 390, 768 et 1440 px, `screen-matrix`, 27 parcours touchés sur build de production) ; à 120 athlètes : `/suivi` 543 Ko au lieu de 1,7 Mo, `/athletes` 583 Ko au lieu de 2,3 Mo ; lecteurs d'écran et téléphones réels non essayés | Opus ; ouvert par Fable |
| Chercher ou créer un exercice (décision du 21 novembre) : un composant partagé `exercise-finder.tsx` cherche dans toute la bibliothèque (serveur, paginé, favoris et listes d'abord, au clavier) et crée une fiche en un geste (nom repris, famille et charge proposées par la règle `suggestExerciseDefaults`, un bouton) ; le constructeur ne renvoie plus vers `/exercices` ; service `quickCreateExercise` et route `POST /exercises/quick` | 175 | En production le 22 novembre, testé (15 tests de la règle, 15 du service dont droits et doublons, parcours `exercise-finder` au clavier seul à 390 et 1440 px, 29 parcours touchés sur build de production) ; de 9 ou 10 gestes et 3 pages à 2 gestes sans quitter la séance ; pas éprouvé en réel | Fable |
| Planificateur refait (décision du 21 novembre) : quatre étapes dans le service (comprendre, retrouver dans toute la bibliothèque, composer, contrôler), modèles GPT-6 choisis à la mesure, termes appris par espace, doutes qui ne bloquent plus (fiche « À vérifier », exercice « à compléter ») ; un seul champ sur le web et sur l'app native, création d'exercice en un geste | 176 | Testé (web 2 454, mobile 283, domaine 496 ; 24 parcours `ai-planner` ; parcours natif joué à la main sur simulateur iOS) ; mesuré en réel sur un corpus gelé de 80 consignes et 150 paires : 75 à 76 séances justes (13 avant la refonte), 0 question inutile (54 avant), 0 faute grave, 145 à 146 fiches retrouvées (69 avant), 11,5 s en médiane, 0,008 $ par demande ; seuils presque tous tenus, mention « bêta » gardée jusqu'à l'essai du fondateur | Fable puis Opus |
| Finitions web : dessin et bascule de l'ancien moteur de gestes retirés (8 454 images prouvées identiques) ; `/seances/[id]/suivi` par tranches de 30 avec recherche (21 641 → 5 593 px à 390 px pour 120 athlètes) ; case dessinée sur `/videos` ; 113 derniers textes en dur rangés, base gelée vide et tenue à zéro ; séries repliées par exercice, `/admin/mouvements` replié par famille | PR `chore/finitions-et-jeu` | Testé (suite Playwright entière : 268 réussis, 0 échec hors WebKit absent du poste et hors jeu retiré) | Opus |
| Jeu public retiré (demande du fondateur, 23 novembre) : `/jeu` redirige vers l'accueil, `packages/game`, son classement, sa modération et son réglage supprimés (107 fichiers, 6 193 lignes) ; tables `game_*` gardées, vides | PR `chore/finitions-et-jeu` | Testé (`landing`, `mascot-board`, `screen-matrix`, `admin-console`, redirection 308) | Opus |
| Inscriptions des athlètes autonomes fermées par défaut (`ATHLETE_SIGNUP_MODE`, défaut `closed`) : elles s'ouvraient seules en production ; seules les clés enregistrées en base remplacent désormais l'environnement | PR `fix/inscriptions-athletes-fermees` | Testé (service et environnement) | Opus |
| Athlète autonome, web (décision du 23 novembre, plan `docs/plans/athlete-autonome.md`) : aiguillage à l'inscription (coach, seul, lien d'invitation), espace personnel gratuit (offre `personal` : 5 propositions IA, 10 min de dictée, 4 vidéos par mois), planification pour soi sans destinataires, premiers pas et 4 e-mails propres, partage facultatif et révocable de l'historique avec un coach (santé exclue), correctifs des impasses d'un compte sans espace, réglage « Inscriptions des athlètes autonomes » | PR `feat/athlete-autonome-pr` | Testé (web 2 507, domaine 514 ; 4 parcours neufs de bout en bout sur build de production) ; textes juridiques à relire par le fondateur ; app native au lot AA3 | Opus |
| Athlète autonome, app native (lot AA3) : aiguillage (coach, seul, invitation) selon `GET /signup-options`, sortie d'un compte sans espace, parcours « Je m'entraîne seul », onglets et constructeur sans destinataires en espace personnel, premiers pas, accords espace par espace (plus de `consent_scope_required`), partage de l'historique et section du coach ; test de force natif réparé (`athleteId` retiré du corps) | PR `feat/athlete-autonome-native` | Testé (mobile 367, web 2 526) ; joué sur le simulateur iOS en local ; Android et flux Maestro neufs à prouver en CI ; aucun nouveau binaire | Opus |
| Page d'accueil de l'ouverture (demande du fondateur, 23 novembre) : film réduit au saut en hauteur, bande des six athlètes retirée, plus aucune mention de pilote, de bêta ni de capture fictive (planificateur et CGV compris), mot « Tartan » dont le T est la marque dans l'en-tête du site, deux sections d'onglets (11 écrans du coach dans un ordinateur, 9 de l'athlète dans un téléphone, dont 8 prises sur l'app native au simulateur iPhone, cadres dessinés en CSS), 20 captures neuves et rejouables (`e2e/landing-captures.spec.ts`) sur un jeu de démonstration rempli (deux groupes, jusqu'à trois séances par jour, un meeting, séries saisies qui nourrissent l'analyse) | PR `feat/landing-ouverture` | Testé (types, lint, tests, design, parcours `landing`, `pilot`, `ai-planner`, `screen-matrix` sur build de production) ; écrans de l'athlète pris sur la web app à 390 px : l'app native est construite et installée sur un simulateur, mais l'accès au simulateur n'a pas été accordé pendant le lot | Opus |
| Transactions plus patientes : le client Prisma attend jusqu'à 10 s une connexion et laisse 15 s à une transaction (défauts de Prisma : 2 s et 5 s), ce qui faisait échouer en `P2028` l'acceptation d'une invitation sur un serveur chargé. Enquête : l'enregistrement d'une séance publiée prend 30 à 90 ms en local, les notifications n'y sont pour rien (heures calmes), et la production n'a aucune erreur de ce type | PR `fix/lenteurs-serveur` | Testé (deux tests qui échouent avec les défauts de Prisma) | Opus |

### En cours

| Lot | Où | Niveau | Mené par |
| --- | --- | --- | --- |
| Parité mobile M1 à M3 (correctifs Maestro compris : connexion par mot de passe qui ouvrait une feuille de navigateur sur iOS, flux réécrits) : connexion par mot de passe, réglages en neuf rubriques sans abonnement, photo et avatars, premiers pas du coach et accueil de l'athlète ; listes et favoris, fiche concise, vidéo de catalogue, chercher ou créer dans le constructeur ; vidéo en plein écran avec tracés au doigt, rappel local de fin de récupération, `/mes-videos`, message de publication (G10) | PR `feat/mobile-compte-pr` | Codé, testé (mobile 350, web 2 473 ; M2 et M3 joués à la main sur simulateur iOS) ; flux Maestro neufs exécutés par la CI seulement ; aucun téléphone physique | Opus |

### Restant à faire

- **Comptes de test du fondateur** : à créer par le vrai parcours d'inscription, coach puis athlète, une fois l'onboarding en production.
- **Planificateur, fin de bêta (P4)** : « (bêta) » est retiré du titre, de la pastille et de la ligne des CGV le 23 novembre, à la demande du fondateur, à l'ouverture de l'app (PR `feat/landing-ouverture`) ; l'essai du fondateur sur la Preview reste à faire. Seuils au 22 novembre : tenus pour les fautes graves (0), les questions inutiles (0) et la latence ; à la limite pour les séances justes (75 à 76 sur 80, seuil 76) et les fiches retrouvées (145 à 146 sur 150, seuil 146) ; un terme absent du catalogue rapproché d'une fiche avec la marque « À vérifier » (seuil 0). Le corpus gelé a servi à régler trois tours : il n'est plus une preuve indépendante.
- **Gestes, suite** : retrait de l'ancien moteur (la morphologie est en production).
- **Reste de l'audit** : `/seances/[id]/suivi` à 120 athlètes (21 641 px à 390 px, pas de rendu par tranches), 171 textes gelés, case native de `/videos`, message de publication sur le mobile, `/seance/[id]/series` et `/admin/mouvements` très longs.
- **Production vidée le 19 novembre** (fait) : sauvegarde chiffrée relue (`sauvegarde.yml`) et branche Neon `sauvegarde-avant-vidage-2026-11-19`, puis suppression en une transaction de tous les comptes sauf l'administrateur (passkey et mot de passe gardés), des 3 espaces, des notifications et des données de test ; catalogue commun (197 fiches), journal d'audit et liste de blocage des e-mails gardés ; la vidéo Mux part par la file de suppression. Reste : créer les deux comptes de test du fondateur une fois l'onboarding en production.
- **L. Recette web** sur les 14 parcours de la section 8.7 du brief, Preview remise à niveau.
- **Parité mobile** en quatre PR, puis les bêtas iOS et Android.

### Points ouverts relevés en route

- Maestro iOS échoue par moments sur des parcours qui changent d'un passage à l'autre ; cause non établie.
- `video-poc` est lent par moments en développement (réponse reçue jusqu'à 7 s après l'envoi), cause non trouvée ; les deux parcours vidéo tournent séparément en CI.
- L'installation des navigateurs de la CI : cinq tentatives qui reprennent les téléchargements, et paquets système gardés en cache depuis la PR 166 (miroir Ubuntu à 50 Ko/s le 18 novembre).
- Maestro iOS rejoue une fois chaque flux en échec, et le job a 120 minutes (PR 166).

Le plan du 15 novembre s'arrête au lot 4 :
- les lots 5 (bêta iOS) et 7 (bêta Android) sont préparés côté textes et reprendront après la web app ;
- le lot 6 (IA qualifiée) est remplacé par la refonte du 21 novembre et l'essai du fondateur sur la Preview.

Le fondateur a ouvert l'application au public le 23 novembre 2026 ; la page d'accueil ne parle plus ni de pilote ni de bêta.

## Édition stade du 25 novembre

60 fiches supplémentaires sont préparées pour la relecture dans la console des exercices. Les 173 fiches diffusées restent disponibles. Chaque nouvelle fiche indique les appuis, le matériel, le comptage et une variante. La diffusion aux athlètes attend les visuels et la relecture technique.

## Décisions du fondateur en vigueur

| Date | Décision |
| --- | --- |
| 13 nov. | Avant la vente : constructeur à circuits, 150 exercices avec guides et visuels, planificateur à deux modes, vidéo collaborative ([PRODUCT.md](../PRODUCT.md)) |
| 13 nov. | Google Play : compte organisation (D-U-N-S demandé le 14 novembre, numéro pas encore attribué) |
| 13 nov. | Clé OpenAI actuelle conservée volontairement : risque non clos, plafond de dépense à poser |
| 14 nov. | Ouverture sans médiateur pour l'instant, risque accepté ; CGV à compléter à l'adhésion |
| 14 nov. | Accords de traitement acceptés chez tous les prestataires ; avis du juriste obtenu (HDS, Mux aux États-Unis, partage au groupe compris), preuve gardée hors du dépôt |
| 14 nov. | Micro-entreprise non assujettie à la TVA (293 B) ; Stripe Tax reste coupé |
| 14 nov. | Guides marqués « consignes indicatives » ; tracés sur vidéo dans le périmètre de cette version |
| 14 nov. | Quota vidéo propre à chaque athlète : 8 par mois en Découverte, 20 en Coach et Club, hors du quota de l'espace ; maquette du constructeur validée |
| 14 nov. | Les 150 guides textuels relus et approuvés par le fondateur ; illustrations à produire |
| 21 nov. | Planificateur : un seul champ, l'IA comprend seule si le coach décrit sa séance, donne un objectif ou mêle les deux (remplace les deux modes du 13 novembre). Mention « bêta » retirée sur preuve : corpus neuf noté avec des seuils fixés d'avance, puis essai du fondateur sur la Preview. 40 € d'appels réels en plus des 30 € du 17 novembre, modèle choisi à la mesure ([PRODUCT.md](../PRODUCT.md#décision-du-21-novembre-2026)) |
| 17 nov. | Gestes : moteur refait, chaque fiche de profil et de face, plus un emplacement vidéo par fiche commune. Planificateur : appels OpenAI réels autorisés pour la mesure, 30 € au plus. Production vidée après sauvegarde, sauf le compte administrateur ; essais en production avec les deux adresses du fondateur. Listes d'exercices privées, partage au choix avec les coachs de l'espace. Ajouts au périmètre : onboarding complet du coach et de l'athlète, réglages en rubriques, photo de profil et avatars, espace de démonstration ([PRODUCT.md](../PRODUCT.md#décision-du-17-novembre-2026)) |
| 16 nov. | Le web d'abord, à 100 %, avant les bêtas natives. Ajouts au périmètre : mot de passe défini par l'utilisateur, listes et favoris d'exercices privés au coach, vidéo en plein écran avec éditeur, glisser-déposer du planning avec retour visuel, gestes plus précis et personnage plus fin, nouveau logo ([PRODUCT.md](../PRODUCT.md#décision-du-16-novembre-2026)) |

## Ce qui tourne

| Élément | État au 21 novembre |
| --- | --- |
| Production | `app.tartan.coach` et `tartan.coach` servent `0385044` (PR 176) le 22 novembre, aucune erreur d'exécution sur 24 h. Base vidée le 19 novembre : il reste le compte administrateur et le catalogue commun. Inscriptions fermées |
| Preview | `preview.tartan.coach`, branche Git `preview` avancée sur `main` le 22 novembre (`0385044`, migrations appliquées par le déploiement) : prête pour l'essai du planificateur et la recette. Base `preview` reconstruite le 14 novembre avec la seule graine de démonstration (4 comptes fictifs), sans donnée de production |
| Neon | Offre Launch, restauration 7 jours, branche `production` protégée, calcul 0,25–2 CU ; branche `preview` 0,25–1 CU. Aucune branche de recette |
| GitHub | Dépôt public, `LICENSE` propriétaire. Analyse des secrets, protection à l'envoi et Dependabot actifs. `main` exige des branches à jour, plus `quality` et `mobile-gate`. `mobile-gate` attend Maestro iOS et Android quand change ce que l'app native embarque (`apps/mobile`, ses paquets, le fichier de verrouillage), soit environ une heure par mise à jour ; une PR purement web le saute, textes de `packages/i18n/src/web/` compris (un test vérifie que le filtre suit les dépendances du mobile). Branches fusionnées supprimées le 16 novembre, `preview` gardée |
| Sauvegardes | Copie chiffrée chaque nuit vers un store Vercel Blob privé, relue par empreinte ; restauration locale chronométrée réussie les 13 et 14 novembre ([sauvegarde](exploitation/sauvegarde.md)) |
| Stripe | Compte dédié Tartan, prix 19/190 € et 59/590 €, webhook de production sur 15 événements, portail configuré. Aucun vrai paiement |
| iOS | Build 14 (1.1.0, profil `beta`) envoyé à App Store Connect le 15 novembre, pas encore installé sur un iPhone. Le partage de la carte de record (`expo-sharing`) et les icônes du nouveau logo exigent un nouveau binaire |
| Android | AAB 1.1.0 (3) du 13 novembre ; build `preview` du 16 novembre pour Maestro ; aucun compte Play |

## Niveau de preuve par fonction

- **Testé** : tests automatisés, prestataires simulés sauf mention.
- **Éprouvé** : constaté en production ou sur appareil réel.

| Fonction | Testé | Éprouvé | État et défauts connus |
| --- | --- | --- | --- |
| Réglages | Oui (table des rubriques et des anciennes ancres, parcours `settings-sections`, matrice des écrans) | Non | **Fait le 17 novembre** : `/reglages` est un sommaire et dix rubriques en sous-pages (profil, connexion, notifications, apparence, confidentialité, espace, groupes, membres, abonnement, aide) ; barre latérale sur ordinateur, liste puis page sous 1024 px ; les dix-huit anciennes ancres sont redirigées ; `/synchronisation` et `/nouveautes` ont un lien dans l'aide.<br>**Reste** : le mot de passe dans la rubrique Connexion (lot suivant) ; deux réponses du centre d'aide citent encore « sous Invitations » et « sous E-mails » (textes partagés avec le mobile, à corriger dans un lot mobile) ; parité mobile |
| Photo de profil et avatars | Oui (recadrage, contrôle serveur, ancienne photo mise en file de suppression, parcours `avatar` contre un Blob simulé) | Non | **Fait le 18 novembre** (constat G14) : photo recadrée dans le navigateur (déplacer, zoomer, pivoter, orientation EXIF), envoyée en carré WebP de 512 px et revérifiée par le serveur ; galerie « Le groupe » (six athlètes) et douze animaux dessinés pour Tartan, aucune banque tierce ([avatars](reference/avatars.md)) ; colonne additive `profiles.avatar_preset` ; un composant `Avatar` dans l'en-tête, le suivi, les athlètes, les membres, les commentaires, les annonces, les vidéos et l'invitation ; même recadrage pour le logo de l'espace.<br>**Reste** : Vercel Blob réel (Preview), pincement et HEIC sur iPhone, parité mobile |
| Connexion, onboarding, espaces, invitations | Oui | Lien magique et e-mail de bienvenue reçus sur Gmail | Better Auth : lien magique (15 min), mot de passe (adresse vérifiée, 10 signes), Google et Apple s'ils sont configurés.<br>**Fait le 18 novembre (brief 4.1)**, testé, pas éprouvé : connexion et création en deux chemins de même rang (mot de passe ou lien) ; écran d'attente qui rappelle l'adresse, renvoie le lien après 30 s et dit quoi faire ; invitation par lien ou mot de passe ; proposition facultative d'un mot de passe à l'athlète entré par lien, refermable, gardée côté serveur ; rubrique Connexion (moyens du compte, définir, changer, déconnecter les autres appareils) ; retour à la page demandée après connexion ; API `/api/v1/me/password` et contrats pour le mobile ; e-mails à chaque définition et changement.<br>**Fait le 19 novembre (onboarding, constats B1, B3, G15)**, testé, pas éprouvé : le coach invite dès la création de l'espace, fait un tour de piste refermable, suit une carte « Pour démarrer » déduite des faits réels (profil ou avatar, invitation, séance, publication, première validation) et retrouve tout sur `/premiers-pas` ; chaque écran a son repère de première visite ; l'athlète reçoit ses consentements dans la transaction d'acceptation, arrive droit sur sa séance un jour de séance, et voit ensuite une carte facultative (photo, mot de passe, installation, notifications) ; l'état est en base et ne revient pas sur un autre appareil ([onboarding](reference/onboarding.md)).<br>**Reste** : réception réelle des e-mails, Google et Apple non configurés, parité mobile ; si un compte créé par mot de passe est ouvert d'abord par un lien de connexion, Better Auth retire le mot de passe sans message à l'écran ; la demande de lien est limitée à 10 par minute (règle `/sign-in/*`), pas 5. Compte neuf et invitation jamais joués par une vraie personne. Outlook et iCloud non éprouvés |
| Séances V2 (circuits, groupes, récupérations) | Oui | Sur le web, en production le 15 novembre | Corrigé le 14 novembre : récupérations hors de la saisie des séries ; ordre des blocs communs en autonomie ; références conservées hors des groupes ; séries précédentes dans l'ordre des tours |
| Constructeur web | Oui | Recette en production le 15 novembre | **Fait selon la maquette validée** : sélecteur unique, « Ajouter ici » à chaque niveau, regroupement d'une sélection, glisser-déposer à la poignée (souris et doigt), une série par tour à l'entrée d'un groupe, résumé « tours × séries », couleurs par famille.<br>**Ajouts du 15 novembre** : remplacement par exercice en autonomie, avec aperçu « Au club / En autonomie » ; séries détaillées (pyramide, échauffement), montrées série par série dans le mode séance |
| Constructeur mobile | Oui, Maestro iOS et Android | Aucun téléphone physique | Lot 3 (PR 148) : séries détaillées, remplacement en autonomie, « Déplacer vers » dans, entre et hors des groupes ; le mode séance coche les séries détaillées une à une. **Reste** : le glisser-déposer au doigt, remplacé par le menu |
| Mode séance | Oui | Sur le web, en production | Minuteur calé sur l'horloge, récupération lancée à la série cochée, enchaînement automatique, vibration, signal sonore, écran gardé allumé, aperçu de l'étape suivante. **Reste** : notification locale sur le mobile natif |
| Suivi du coach, statuts des séances | Oui | Sur le web | Corrigé au lot 3 : l'échéance d'une séance se compte à Paris (`endOfTrainingDay`) et non plus en fin de journée UTC, pour le suivi, les relances, le cron et les métriques |
| Calendrier du coach | Oui (parcours `calendar-drag` : souris, toucher émulé, clavier, refus du serveur, mouvement réduit, axe, séance verrouillée) | Non pour le glisser-déposer refait | Vues Semaine, Mois et Liste.<br>**Fait le 17 novembre (brief 4.2)** : le planning reprend la mécanique du constructeur (`lib/use-pointer-drag.ts`) ; carte d'origine en pointillés, aperçu qui nomme le jour visé, jour survolé éclairé, repère du rang d'arrivée ; dépôt optimiste en 260 ms, retour à la place d'origine avec un message si le serveur refuse ; appui long et défilement aux bords au doigt ; « Déplacer » et « Dupliquer » au clavier en vue Mois ; une séance non modifiable porte un cadenas ; les phases tiennent en une ligne repliée.<br>**Reste** : le toucher sur un vrai téléphone, Safari iOS, VoiceOver et TalkBack. Aucune règle de « passé verrouillé » n'existe : seule l'interdiction par les droits est affichée |
| Catalogue, guides et listes d'exercices | Oui (droits des listes, guides concis vérifiés par leurs règles de longueur, parcours `exercise-lists`) | 173 fiches en production ; listes non éprouvées | **Contenu** : catalogue version 5, 173 fiches, 150 relues par le fondateur, 23 variantes « en préparation ». Mention « consignes indicatives ».<br>**Fait le 18 novembre (brief 4.3, constats G3 et G11)** : listes du coach privées, partageables en lecture seule avec les coachs de l'espace ; Favoris à la première étoile ; « Personnaliser » une fiche commune en une copie dont le guide s'édite ; création d'un exercice dans une liste ; API commune pour le mobile. Guides concis pour les 173 fiches (objectif 70 signes, mise en place 80, étape 70, erreur 55, 380 au total), le texte relu restant sous « Détail » tant que la famille n'est pas validée. Fiche à sa propre adresse, geste d'abord, variantes en liens. Bibliothèque en un seul système de pastilles, tranches de 40, vignette du geste : 16 408 → 3 487 px à 390 px. Constructeur chargé à la demande : `/seances/nouvelle` passe de 849 à 99 Ko, sélecteur en feuille sous 1024 px.<br>**Fait le 22 novembre** : création d'une fiche en un geste depuis le constructeur, la bibliothèque et une liste (`exercise-finder.tsx`), le formulaire complet restant derrière « Compléter la fiche ».<br>**Reste** : relecture des guides concis par le fondateur (planches par famille) ; réordonner les fiches dans une liste ; méthode de création rapide dans `packages/api-client` pour le mobile ; parité mobile |
| Gestes animés des guides | Oui (2 299 tests du paquet : limites articulaires, rien sous le sol, appuis qui ne glissent pas, prise constante, tenues immobiles, dynamique par famille ; parcours des guides) | Rien n'est validé par le fondateur, tout s'affiche « Illustration de travail » ; aucun geste regardé en mouvement par un humain | **Fait du 17 au 18 novembre (brief 4.5)** : nouveau moteur (`packages/mascot/src/v2/`) à squelette 3D léger, cinématique inverse, appuis et prises tenus, barre à deux mains sur trajectoire, durée et courbe par transition ; personnage de 6,8 têtes, validé par le fondateur le 17 novembre. Les 173 fiches passent sur ce moteur : 77 gestes écrits à la main (toute l'haltérophilie, la musculation de base, la pliométrie au vol réglé sur la gravité, les gestes autrefois dessinés de face, la course par un générateur de foulée), 96 relevés de l'ancien moteur. Lecteurs web (sans rendu React par image) et mobile (30 images par seconde) avec bascule Profil, Face ou Dessus ; frise en mouvement réduit ; atelier `/admin/mouvements` en deux vues, nouvelle série de relecture « famille:v2 ».<br>**Reste** : relecture du fondateur par famille ; quelques gestes relevés trop petits dans leur vignette (lancers, impulsions) ; pas de rotation axiale du buste ; la nouvelle morphologie dans le film, le jeu et les e-mails ; la vidéo de catalogue ; le retrait de l'ancien moteur ; lecteur mobile non éprouvé sur appareil |
| Planificateur IA | Oui (prestataire simulé pour les tests et les parcours ; appels réels pour la mesure) | Mesuré en réel sur un corpus gelé le 22 novembre ; aucun coach réel | **Refait les 21 et 22 novembre** (décision du fondateur) : un seul champ, le coach décrit sa séance, donne un objectif ou mêle les deux ; quatre étapes dans le service (comprendre, retrouver dans toute la bibliothèque, composer, contrôler) ; un rapprochement incertain est posé avec « À vérifier » et les autres fiches possibles, un exercice absent devient un emplacement « à compléter » qui se crée en deux gestes ; les choix du coach sont appris par espace ; l'ajustement part de la séance à l'écran ; même parcours sur l'app native ([planificateur-ia](reference/planificateur-ia.md)).<br>**Mesure réelle sur 80 consignes et 150 paires gelées, trois passages** : avant la refonte (`gpt-4.1`, un appel) 13 séances justes, 54 questions inutiles sur 72, 69 fiches retrouvées, 1 date fausse ; après, 75 à 76 séances justes, 0 question inutile, 0 faute grave, 145 à 146 fiches retrouvées, médiane 11,5 s, 0,008 $ par demande. Dépense réelle de la refonte : 22,94 $.<br>**Reste** : essai du fondateur sur la Preview (« bêta » est retiré depuis le 23 novembre, à sa demande) ; dictée réelle non éprouvée ; Maestro des nouveaux flux natifs à confirmer en CI ; les charges adaptées par athlète ne survivent pas à un ajustement |
| Vidéo collaborative | Oui | Envoi, encodage Mux, remarque et angle tracé en production le 15 novembre | **Fait** : `/mes-videos`, phases génériques, partage au groupe ; tracés (ligne, flèche, angle mesuré, cercle) ; quotas par athlète ; droits corrigés le 14 novembre.<br>**Fait le 18 novembre (brief 4.4)**, testé, pas éprouvé sur appareil : plein écran par bouton ou touche F, éditeur en panneau à droite repliable et élargissable sur ordinateur et en paysage, feuille à trois hauteurs sur téléphone en portrait ; raccourcis espace, flèches, F, M et Échap, muets pendant la saisie ; image collée en haut sous 1024 px ; tracés posables au clavier.<br>**Reste** : Safari iOS, Android et clavier virtuel réels, VoiceOver et TalkBack ; en surcouche, le bouton retour d'Android quitte la page ; `video-poc` lent par moments en développement (réponse reçue jusqu'à 7 s après l'envoi, cause non trouvée) ; tracés en lecture seule sur le mobile natif |
| Charges, records, progression, phases | Oui | Partiel, sur le web | — |
| Notifications, e-mails | Oui | Gmail seulement ; aucun push réel | — |
| Abonnements Stripe | Oui, et six tests sandbox réels dans le navigateur | Aucun vrai paiement | Retour vers Tartan après paiement non prouvé |
| Hors ligne, PWA | Oui | Pas au stade | — |
| Mobile natif | Oui, Maestro iOS et Android (lot 3, exigés par `mobile-gate` ; le flux du circuit reste sur iOS) | Aucun téléphone physique | **Fait** : file d'envoi vidéo rattachée au compte ; mise à jour à distance par profil, canal `beta` ; version d'exécution par empreinte ; lint mobile ; motif d'absence, série de régularité, carte de record ; les parcours natifs ne dépendent plus de l'heure.<br>**Reste** : cartes de sources Sentry (jeton à créer) ; parité des lots du brief du 16 novembre |
| Logo et icônes | Oui (présence et dimensions de chaque fichier, fichiers cités par l'app et le manifeste) | Regardé sur un serveur local ; pas sur le simulateur iOS ni dans un onglet de Chrome réel | **Fait** : le fondateur a choisi le 17 novembre le « T des couloirs » (deux couloirs qui tournent, ligne d'arrivée citron). `scripts/build-logo.mjs` produit tous les fichiers : web (onglet, PWA, masquable, logotype, e-mail, image de partage), iOS (claire, sombre, teintée), Android (adaptative, à thème), notification, écran de lancement. Section « Logo » dans `DESIGN.md`.<br>**Reste** : les icônes natives n'arrivent qu'avec le prochain binaire (le build 14 garde l'ancien logo) |

## Portes d'ouverture

Détail : [commercialisation](plans/commercialisation.md).

| Porte | État |
| --- | --- |
| 1. Juriste | Franchie sur déclaration du fondateur (14 nov.) |
| 2. Médiateur, CGV | Médiateur différé par décision du fondateur ; les CGV disent que ses coordonnées viendront à l'adhésion |
| 3. OpenAI | Accord de traitement accepté ; clé conservée par décision, plafond de dépense à poser |
| 4. Vrai paiement | Ouverte |
| 5. Configuration | Webhooks Stripe et Resend éprouvés ; sondes et passkey de secours restantes |
| 6. Mux, Neon, sauvegardes | Franchie : Neon Launch, sauvegardes privées restaurées, aucun plafond technique Mux, quotas des offres seuls |
| 7. E-mails | Gmail fait ; Outlook et iCloud restants |
| 8. Téléphones | Ouverte |
| 9. Compte neuf sans aide | Ouverte |
| 10. Tests critiques | Franchie le 11 novembre |
| 11. Refonte du 16 novembre | Ouverte : les six demandes du brief, les ajouts du 17 novembre et les sept défauts bloquants de l'audit |

**Matrice des écrans.**
- `apps/web/e2e/screens.ts` liste chaque page avec ses rôles et ses preuves.
- Un test refuse toute page absente de la matrice.
- Un balayage visiteur, coach et athlète tourne à 390, 768 et 1440 px (axe, débordement, erreur).
- L'accord parental et les liens d'e-mail ne sont prouvés que par des tests serveur.

## Ce qui revient au fondateur

1. **TestFlight.** Le build iOS 15 (1.1.0, 24 novembre : parité mobile, athlète autonome, textes d'autorisation et icônes du logo) est envoyé sur TestFlight le 24 novembre (clé App Store Connect déjà enregistrée sur EAS ; lancer `eas submit` avec `APP_VARIANT=production` et `EXPO_PUBLIC_API_URL`). Installe-le sur ton iPhone dès qu'Apple l'a traité, puis rejoue une séance d'athlète, notification comprise. La soumission à la revue d'Apple reste à toi. Le build Android 5 (`.aab`) est prêt sur EAS, en attente du compte Google Play.
2. **Bêtas.** Les textes sont prêts dans [betas](reference/betas.md). Il te reste à saisir le compte de revue, à soumettre la bêta à Apple et à créer le compte Play après le D-U-N-S. Ces étapes reprennent après la web app.
3. **Sentry.** Créer un jeton Sentry (portée `project:releases`) et le poser sur EAS (`eas env:create --name SENTRY_AUTH_TOKEN --visibility secret`). L'agent retirera ensuite `SENTRY_DISABLE_AUTO_UPLOAD`.
4. **OpenAI.** Poser un plafond de dépense mensuel sur le projet : 70 € pendant la refonte du planificateur.
5. **Passkey de secours.** La créer sur un second appareil, avant que `ADMIN_BOOTSTRAP_TOKEN` soit retiré.
6. **Google Play.** Recevoir le D-U-N-S, puis créer le compte organisation : identité, paiement, contrat.
7. **Relectures.**
   - Les 23 guides de la version 5 (`packages/domain/src/exercise-catalog/variants.ts`).
   - Les gestes, famille par famille, dans `/admin/mouvements`, y compris les « Nouveaux gestes, vus de face » (lot 4), qui ont leur propre bouton ; sans validation, l'athlète les voit avec la mention « Illustration de travail ».
   - Les guides réécrits plus courts.
8. **Choix visuel.** Le prototype du nouveau personnage (le logo est choisi).
9. **Essai du planificateur.** Quand l'agent le signale : une vingtaine de vraies consignes, dictées comprises, sur la Preview (environ 20 minutes). C'est la dernière preuve avant le retrait de « bêta » (décision du 21 novembre). Le corpus de 40 consignes et 30 dictées reste possible, sans être bloquant. Le format, le gel et la commande sont dans [planificateur-ia](reference/planificateur-ia.md#corpus-du-fondateur-lot-6) ; l'agent ne lance aucun appel payant.
10. **Inscriptions.** Ouvertes en production le 23 novembre à ta demande, pour les coachs et pour les athlètes autonomes (réglages `signupMode` et `athleteSignupMode` à `public` dans `platform_settings`). Sans ces réglages, les deux variables d'environnement les tiennent fermées. Tu les refermes, ensemble ou séparément, dans `/admin/configuration`.
11. **Recettes et ouverture.** Paiement réel accompagné, e-mails sur Outlook et iCloud, recette sur tes téléphones, pilote sans guidage, puis décision d'ouverture.

Le mot de passe des comptes de démonstration de la Preview est dans `.local/preview-demo-password`, sur le poste de l'agent qui l'a créé, jamais dans le dépôt.

## Décisions ouvertes

| Sujet | Recommandation |
| --- | --- |
| Morphologie du personnage | Plus athlétique (6 à 7 têtes), une seule pour tout le produit, après validation d'un prototype |
| Bibliothèque d'animation | Aucune pour l'instant ; l'agent la propose avec ses raisons s'il la juge indispensable |
| Abonnement web face à Apple (3.1.1) | Soumettre sans achat intégré, repli préparé |
| IA à la première revue Apple | Ouverte, compte de revue en offre Coach (2.5.19) |
| Choix du modèle IA | Fait le 22 novembre, à la mesure : `gpt-6.1-terra` pour comprendre, retrouver et composer une séance décrite ; `gpt-6.2-sol` pour composer ce qui est à proposer et pour réparer ; 0,008 $ par demande en moyenne |
| Mise en veille du calcul Neon de production | Gardée (5 min) ; la désactiver coûte environ 25 $ par mois |

## Risques à garder en tête

- **Modèles OpenAI en fin de vie** : `gpt-4.1` et `gpt-4.1-mini` s'arrêtent le 14 janvier 2027, `whisper-1` et `gpt-4o-transcribe` le 26 février 2027 (page Deprecations d'OpenAI, lue le 21 novembre). Le planificateur doit passer à la gamme GPT-6 avant janvier ; la dictée utilise déjà `gpt-transcribe`.
- **Clé OpenAI anciennement exposée**, conservée par décision : sans plafond de dépense, un abus se paierait.
- **Opérations Neon** : la panne du 13 novembre vient d'une restauration finalisée sur la production ([incident](exploitation/incident.md#incidents-passés)). Jamais de finalisation hors sinistre.
- **Refonte du personnage** : il est partagé par le site, le film, les e-mails et les guides, soit environ 40 fichiers. Une morphologie nouvelle touche tout, et relance Maestro à chaque mise à jour de PR.
- **Refus Apple 3.1.1** : l'exception 3.1.3(f) ne vise pas un outil de coaching.
- **Webhook Stripe** : factures, remboursements et litiges ne passent par la route que dans la recette sandbox, hors CI.
- **Sentry gratuit** : une seule sonde de crons ; la sonde de disponibilité est assurée par `surveillance.yml`.
- **Textes en dur hérités** : 176 textes gelés dans `apps/web/eslint-suppressions.json`, sur 37 fichiers.
- **Balayage de la CI** : la matrice des écrans tourne sur un espace vide ; `filled-sweep.spec.ts` couvre depuis le lot K2 `/suivi`, `/athletes`, `/calendrier` et `/seances/[id]/suivi` sur un espace rempli. Les autres écrans ne sont vus qu'à vide.

## Hors périmètre de la V1

La liste est dans [PRODUCT.md](../PRODUCT.md#hors-périmètre). Tout ajout passe par une décision du fondateur, consignée là-bas.
