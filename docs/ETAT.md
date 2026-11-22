# État du projet

Mis à jour le 21 novembre 2026. Toute PR qui change un état met ce fichier à jour.

Ce fichier est une photographie. L'historique des lots vit dans Git (`git log -p docs/ETAT.md`) et les passations dans [JOURNAL.md](JOURNAL.md).

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
| Gestes, morphologie partout : un seul corps dans le film, le jeu, les cartes du groupe, les e-mails et le mobile ; mains et pieds sur leur objet ; vidéo de catalogue par fiche (`/admin/exercices`) | 169 | En production le 21 novembre, testé (2 903 tests du paquet, parcours `landing`, `game-page`, `mascot-board`, `catalog-video`) ; aucune vidéo de catalogue déposée | Opus ; fusionné par Fable |
| H. Planificateur IA, version du lot H : erreurs lisibles, sortie alignée sur le constructeur, contexte de « Proposer », réponse diffusée, écran en deux temps | 170 | En production le 21 novembre, testé contre le prestataire simulé ; mesuré le 21 novembre sur un corpus neuf : 13 séances justes sur 80, d'où la refonte | Opus ; fusionné par Fable |
| K1. Corrections de l'audit : filtres de `/videos` en feuille (G2), service worker limité aux fichiers qui existent (G5), nom de l'espace lisible dans l'en-tête à 390 px (G6), `/analyse` hiérarchisée (G9), message de publication qui dit qui reçoit la séance (G10) | 171 | En production le 21 novembre, testé (règles pures, service de publication, parcours `video-filters`, `training-analysis`, `shell`, `screen-matrix`) ; hors ligne réel non éprouvé | Opus ; fusionné par Fable |
| G. Onboarding complet du coach et de l'athlète (constats B1, B3, G15) : invitation dès la création de l'espace, « Ton tour de piste », carte « Pour démarrer », page `/premiers-pas`, repères de première visite, accueil de l'athlète qui ne retarde jamais sa séance, carte facultative après la première validation, état gardé en base (`OnboardingState`) | PR `feat/onboarding-complet` | Codé, testé (suite Playwright entière le 19 novembre : 257 réussis, 0 échec ; validation de l'athlète mesurée à 0,8 s ; parcours rejoués le 21 novembre après fusion de `main`) ; jamais joué par une vraie personne | Opus ; ouvert par Fable |
| Espace de démonstration : un coach neuf ouvre depuis `/premiers-pas` un espace séparé et jetable, rempli de 8 athlètes fictifs sans compte, de séances passées et à venir, de validations et de phases ; bandeau permanent, suppression en un geste, purge à 14 jours | PR `feat/espace-demo` | Codé, testé (20 tests d'exclusion, un par service : planificateur, vidéo, invitations, notifications, e-mails, cron, facturation, statistiques, mesure d'audience ; parcours `demo-space` sur build de production) ; jamais ouvert par un vrai coach | Opus ; ouvert par Fable |

### En cours

| Lot | Où | Niveau | Mené par |
| --- | --- | --- | --- |
| Refonte du planificateur validée le 21 novembre (quatre étapes, champ unique, fin de bêta sur preuve) | P1 fait sur `feat/ia-mesure-bout-en-bout` et `feat/ia-corpus` (outil de mesure sur le service, corpus gelé de 80 consignes et 150 paires) ; P2 `feat/ia-etapes` en cours ; P3 à P5 à suivre | Mesure de départ réelle du 21 novembre, `gpt-4.1`, un passage : 13 séances justes sur 80, 54 questions inutiles sur 72, 69 fiches retrouvées du premier coup sur 150, 1 date fausse ; 5,49 $ | Fable |
| Lot K2 de l'audit | Branche `fix/audit-k2`, prête, en file | Codé, testé | Opus |

### Restant à faire

- **Comptes de test du fondateur** : à créer par le vrai parcours d'inscription, coach puis athlète, une fois l'onboarding en production.
- **H. Planificateur IA, refonte du 21 novembre** (le fondateur juge qu'il « ne comprend pas ce qu'on veut ») :
  - P1 : mesure de bout en bout sur le service, corpus neuf de 80 consignes écrit par un agent isolé, 150 paires « terme dit, fiche attendue », seuils codés ;
  - P2 : quatre étapes dans le service (comprendre, retrouver sur toute la bibliothèque, composer, contrôler), alias appris par espace, doutes qui ne bloquent plus la séance, modèles GPT-6 ;
  - P3 : champ unique, « Ce que j'ai compris », un seul composant « chercher ou créer » partagé avec le constructeur, création d'exercice en un geste ;
  - P4 : trois passages, essai du fondateur sur la Preview, retrait de « bêta » ;
  - P5 : parité de l'app native.
- **Gestes, suite** : retrait de l'ancien moteur (la morphologie est en production).
- **K. Corrections de l'audit** : K1 prêt sur `fix/audit-corrections` (G2, G5, G6, G9, G10), K2 prêt sur `fix/audit-k2` (B6 et balayage sur données remplies, G4, G8, G13, lien d'évitement). Restent : `/seances/[id]/suivi` à 120 athlètes (21 641 px à 390 px), 171 textes gelés, message de publication sur le mobile.
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
- le lot 6 (IA qualifiée) attend le corpus du fondateur.

Les inscriptions restent fermées jusqu'à la décision d'ouverture du fondateur.

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
| Production | `app.tartan.coach` et `tartan.coach` servent la PR 170 le 21 novembre, pages publiques en 200. Base vidée le 19 novembre : il reste le compte administrateur et le catalogue commun. Inscriptions et classement du jeu fermés |
| Preview | `preview.tartan.coach`, branche Git `preview` gardée, en retard de plus de cent commits sur `main` : à remettre à niveau avant la recette. Base `preview` reconstruite le 14 novembre avec la seule graine de démonstration (4 comptes fictifs), sans donnée de production |
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
| Catalogue, guides et listes d'exercices | Oui (droits des listes, guides concis vérifiés par leurs règles de longueur, parcours `exercise-lists`) | 173 fiches en production ; listes non éprouvées | **Contenu** : catalogue version 5, 173 fiches, 150 relues par le fondateur, 23 variantes « en préparation ». Mention « consignes indicatives ».<br>**Fait le 18 novembre (brief 4.3, constats G3 et G11)** : listes du coach privées, partageables en lecture seule avec les coachs de l'espace ; Favoris à la première étoile ; « Personnaliser » une fiche commune en une copie dont le guide s'édite ; création d'un exercice dans une liste ; API commune pour le mobile. Guides concis pour les 173 fiches (objectif 70 signes, mise en place 80, étape 70, erreur 55, 380 au total), le texte relu restant sous « Détail » tant que la famille n'est pas validée. Fiche à sa propre adresse, geste d'abord, variantes en liens. Bibliothèque en un seul système de pastilles, tranches de 40, vignette du geste : 16 408 → 3 487 px à 390 px. Constructeur chargé à la demande : `/seances/nouvelle` passe de 849 à 99 Ko, sélecteur en feuille sous 1024 px.<br>**Reste** : relecture des guides concis par le fondateur (planches par famille) ; réordonner les fiches dans une liste ; option du planificateur pour privilégier les listes ; parité mobile |
| Gestes animés des guides | Oui (2 299 tests du paquet : limites articulaires, rien sous le sol, appuis qui ne glissent pas, prise constante, tenues immobiles, dynamique par famille ; parcours des guides) | Rien n'est validé par le fondateur, tout s'affiche « Illustration de travail » ; aucun geste regardé en mouvement par un humain | **Fait du 17 au 18 novembre (brief 4.5)** : nouveau moteur (`packages/mascot/src/v2/`) à squelette 3D léger, cinématique inverse, appuis et prises tenus, barre à deux mains sur trajectoire, durée et courbe par transition ; personnage de 6,8 têtes, validé par le fondateur le 17 novembre. Les 173 fiches passent sur ce moteur : 77 gestes écrits à la main (toute l'haltérophilie, la musculation de base, la pliométrie au vol réglé sur la gravité, les gestes autrefois dessinés de face, la course par un générateur de foulée), 96 relevés de l'ancien moteur. Lecteurs web (sans rendu React par image) et mobile (30 images par seconde) avec bascule Profil, Face ou Dessus ; frise en mouvement réduit ; atelier `/admin/mouvements` en deux vues, nouvelle série de relecture « famille:v2 ».<br>**Reste** : relecture du fondateur par famille ; quelques gestes relevés trop petits dans leur vignette (lancers, impulsions) ; pas de rotation axiale du buste ; la nouvelle morphologie dans le film, le jeu et les e-mails ; la vidéo de catalogue ; le retrait de l'ancien moteur ; lecteur mobile non éprouvé sur appareil |
| Planificateur IA | Oui, prestataire simulé | Un parcours réel complet | **Corrigé** : contrôles actifs après une question ; passe déterministe pour les noms inconnus ; « Ajuster » ; exercices visibles avant « Relire » ; « Remplacer » garde la prescription ; dictée nourrie de la bibliothèque.<br>**Prêt** (PR 150) : outil de qualification sur le corpus du fondateur, avec des critères écrits avant les réponses.<br>**Mesure de départ du 17 novembre** (appels réels, `gpt-4.1-mini`, corpus de 80 cas, trois passages) : 66, 61 et 68 réussis sur 80 pour un seuil de 76 ; aucune date fausse ni charge inventée ; une question posée alors que la consigne suffisait revient 4, 8 puis 4 fois selon le passage, soit 16 des 45 échecs ; latence médiane 5,0 s, 11,8 s au 95e centile. Le rapport de départ ne compte pas les jetons ; l'outil les compte désormais (`--summary`).<br>**Lot H (18 et 19 novembre)**, testé contre le prestataire simulé : erreurs lisibles et non décomptées, sortie alignée sur le constructeur (séries détaillées, remplacement en autonomie), contexte de « Proposer » (profil, séances voisines, références de force), réponse diffusée par étapes, écran « Demande » puis « Séance » dans le vrai éditeur ; 75 sur 80 avec `gpt-4.1` en un passage, seuil de 76 non atteint, 4 des 5 échecs étant des questions posées à tort.<br>**Défauts de fond relevés le 21 novembre** : un seul appel fait tout ; bibliothèque coupée à 150 fiches ; rapprochement des noms purement typographique ; un doute bloque toute la séance ; rien n'est appris d'un choix du coach ; la mesure n'exerce pas le service ; mention « bêta » à trois endroits ; app native restée à l'ancien parcours.<br>**Reste** : la refonte du 21 novembre (P1 à P5, voir « Restant à faire ») |
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

1. **TestFlight.** Installer la bêta sur ton iPhone (build 14), puis rejouer une séance d'athlète, notification comprise.
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
10. **Recettes et ouverture.** Paiement réel accompagné, e-mails sur Outlook et iCloud, recette sur tes téléphones, pilote sans guidage, puis décision d'ouverture.

Le mot de passe des comptes de démonstration de la Preview est dans `.local/preview-demo-password`, sur le poste de l'agent qui l'a créé, jamais dans le dépôt.

## Décisions ouvertes

| Sujet | Recommandation |
| --- | --- |
| Morphologie du personnage | Plus athlétique (6 à 7 têtes), une seule pour tout le produit, après validation d'un prototype |
| Bibliothèque d'animation | Aucune pour l'instant ; l'agent la propose avec ses raisons s'il la juge indispensable |
| Abonnement web face à Apple (3.1.1) | Soumettre sans achat intégré, repli préparé |
| IA à la première revue Apple | Ouverte, compte de revue en offre Coach (2.5.19) |
| Choix du modèle IA | Après la qualification, coût compris |
| Mise en veille du calcul Neon de production | Gardée (5 min) ; la désactiver coûte environ 25 $ par mois |
| Classement du jeu ouvert à tous | Le fondateur l'ouvre quand il le souhaite |

## Risques à garder en tête

- **Modèles OpenAI en fin de vie** : `gpt-4.1` et `gpt-4.1-mini` s'arrêtent le 14 janvier 2027, `whisper-1` et `gpt-4o-transcribe` le 26 février 2027 (page Deprecations d'OpenAI, lue le 21 novembre). Le planificateur doit passer à la gamme GPT-6 avant janvier ; la dictée utilise déjà `gpt-transcribe`.
- **Clé OpenAI anciennement exposée**, conservée par décision : sans plafond de dépense, un abus se paierait.
- **Opérations Neon** : la panne du 13 novembre vient d'une restauration finalisée sur la production ([incident](exploitation/incident.md#incidents-passés)). Jamais de finalisation hors sinistre.
- **Refonte du personnage** : il est partagé par le site, le film, le jeu, les e-mails et les guides, soit environ 40 fichiers. Une morphologie nouvelle touche tout, et relance Maestro à chaque mise à jour de PR.
- **Refus Apple 3.1.1** : l'exception 3.1.3(f) ne vise pas un outil de coaching.
- **Webhook Stripe** : factures, remboursements et litiges ne passent par la route que dans la recette sandbox, hors CI.
- **Sentry gratuit** : une seule sonde de crons ; la sonde de disponibilité est assurée par `surveillance.yml`.
- **Textes en dur hérités** : 176 textes gelés dans `apps/web/eslint-suppressions.json`, sur 37 fichiers.
- **Balayage de la CI sur un espace vide** : la matrice des écrans ne voit pas un défaut qui n'apparaît qu'avec des données, comme le débordement de `/suivi` à 390 px.
- **Jeu public** : le rejeu serveur ne prouve pas qu'un humain a joué ; le classement demande une modération.

## Hors périmètre de la V1

La liste est dans [PRODUCT.md](../PRODUCT.md#hors-périmètre). Tout ajout passe par une décision du fondateur, consignée là-bas.
