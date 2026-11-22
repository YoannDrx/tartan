# Audit et refonte de la web app (brief du 16 novembre 2026)

Ce document est la consigne complète d'un agent (Claude Fable 5 ou un autre) chargé de mener la web app à 100 % avant de reprendre iOS et Android. Il se lit après `AGENTS.md`. L'état du jour reste dans [../ETAT.md](../ETAT.md) ; ce brief décrit l'état au 16 novembre pour comprendre le point de départ, puis le travail demandé.

Les constats techniques ci-dessous ont été relevés dans le code le 16 novembre, sur `main` à `df446d0`. Vérifie-les avant de t'y fier : le code fait foi.

---

## 1. Ta mission

Tu reprends Tartan, l'application de préparation physique du coach et de son groupe, ancrée dans l'athlétisme (lis [../../PRODUCT.md](../../PRODUCT.md)). Le fondateur veut une **web app entièrement fonctionnelle, belle et précise**, prête à vendre, avant d'enchaîner sur les bêtas iOS et Android.

Tu fais deux choses, dans cet ordre :

1. **Un audit complet** de la web app : chaque écran, chaque rôle (coach, athlète, visiteur, administrateur), chaque fonction, l'UI, l'UX, l'accessibilité, la performance et la justesse des données. Tu le rejoues en vrai dans le navigateur, sur la base locale avec la graine, à 390, 768 et 1440 px.
2. **L'implémentation**, lot par lot, des demandes du fondateur (section 4) et des défauts que ton audit trouve.

Tu travailles en autonomie. Tu ne t'arrêtes que pour les décisions qui reviennent au fondateur (section 6) et pour les deux validations visuelles demandées : le logo (4.6) et le prototype du personnage (4.5).

## 2. Règles à ne jamais enfreindre

Toutes les règles d'`AGENTS.md` s'appliquent. Les plus importantes, rappelées ici :

- **Le dépôt est public.** Aucun secret, identifiant de compte, adresse de base ou donnée réelle dans le code, la doc, les commits, les PR ou les journaux de CI. Les secrets se posent par la ligne de commande déjà connectée (`vercel env add`, `gh secret set`, `eas env:create`) sans jamais les afficher.
- **Jamais de finalisation d'une restauration Neon sur la branche de production.** La panne du 13 novembre en vient ([incident](../exploitation/incident.md)).
- **Ne contourne pas `assertEnvIsolation`.** Hors production, la base de production et une clé Stripe réelle sont refusées au démarrage.
- **Aucun essai sur la production avec des comptes créés pour l'occasion.** Les essais se font en local ou sur la Preview.
- **Ne touche pas aux réglages du fondateur.** Il ouvre lui-même les inscriptions, gère les paiements réels et les engagements légaux, et soumet aux stores.
- **Aucune requête Prisma hors de `apps/web/src/server/*` et `src/lib`.** Tout service appelle `requireOrgMember`. Les notes privées du coach ne sont jamais lues pour un athlète.
- **Aucun texte en dur** (`packages/i18n`) ni aucune couleur en dur (`packages/design-tokens`), ni durée ou courbe d'animation en dur (`motion.ts`). Le lint le refuse. N'ajoute jamais d'entrée à `apps/web/eslint-suppressions.json`. Quand tu touches un fichier gelé, déplace ses textes puis lance `pnpm --filter @tartan/web lint:prune`.
- **Aucune donnée de santé** dans les journaux, les notifications ou les analyses d'usage.
- **Migrations additives uniquement.**
- **Un appel à un SDK asynchrone est toujours attendu**, sans `as unknown as`.
- **Pas de bibliothèque d'animation** sans décision explicite du fondateur (`DESIGN.md`). Si tu en juges une indispensable, propose-la avec ses raisons et attends.
- **Interface.** `DESIGN.md` est la seule source. Chaque écran modifié est conçu à 390 px, puis regardé à 390, 768 et 1440 px, sans débordement, sans erreur axe, et en mouvement réduit. Chaque écran modifié passe par les compétences UI/UX Pro Max, Frontend Design puis Impeccable quand elles sont disponibles. Les interdits « aucun AI slop » de `DESIGN.md` sont bloquants.
- **Stores.** Sur iOS et Android, aucune mention de prix, d'offre payante ni de lien d'achat.
- **Les commentaires « § 11.4 »** renvoient à un ancien cahier des charges absent du dépôt : ne les suis pas, n'en ajoute pas.

### Méthode

- **Un lot, une branche, une PR**, branches `feat/…`, `fix/…`, `docs/…`, `test/…`, commits en anglais au format conventionnel. Ni force-push ni rebase : on intègre `main` par une fusion.
- **Avant la PR**, lance `corepack pnpm typecheck`, `lint`, `test`, `design:check`, et `E2E_PROD=1 corepack pnpm test:e2e` dès qu'un parcours web change (Node 22, pnpm 10).
- **Un défaut corrigé = un test** qui échouait avant la correction.
- **Dans chaque PR**, mets à jour `docs/ETAT.md` (photographie courte, pas un journal) et ajoute une entrée en haut de `docs/JOURNAL.md`.
- **Fusion.** Tu fusionnes toi-même une PR **dont la CI est verte**. Vérifie ensuite `https://app.tartan.coach/api/v1/version` (le `build` doit être le commit de fusion), puis les erreurs d'exécution Vercel de production sur 24 h, avertissements compris. Supprime la branche distante et la branche locale.
- **Protection de `main`.** Elle exige des branches à jour (`strict`) et les contrôles `quality` et `mobile-gate`. Une PR qui touche le mobile ou un paquet partagé qu'il embarque (`packages/api-client`, `contracts`, `design-tokens`, `domain`, `mascot`, et `i18n` hors de `src/web/`) relance Maestro iOS et Android, soit une heure environ par mise à jour. Une PR purement web saute Maestro, y compris quand elle ajoute des textes dans `packages/i18n/src/web/` (lot 0 du 17 novembre).
  - Ordonne les fusions pour ne pas relancer Maestro pour rien.
  - Avant de fusionner une PR empilée, passe la base de ses enfants sur `main` (`gh pr edit --base main`), sinon GitHub les ferme.
- **Écris le niveau atteint, jamais l'intention.** Trois niveaux, à ne pas confondre :
  - **codé** ;
  - **testé** automatiquement ;
  - **éprouvé** en production ou sur un appareil réel.

  Un test qui simule un prestataire ne prouve pas le prestataire.

### Pièges connus

- **Bases et port partagés.** Plusieurs sessions d'agents peuvent tourner en même temps sur ce poste : elles partagent la base Postgres locale (port 54329) et le port 3100. Isole ta base avant Vitest et Playwright (voir [../tests/README.md](../tests/README.md)).
- **Doublons de fichiers.** `.claude/worktrees/` et `~/.codex/worktrees/` contiennent des copies du dépôt. Exclus-les de tes recherches, sinon tu liras de vieux doublons.
- **Service worker.** Celui de la PWA sert d'anciens fichiers en développement : désinscris-le avant un essai local.
- **Heure de Paris.** La graine date les données à l'heure de Paris. Le suivi compte désormais l'échéance à Paris (`endOfTrainingDay`). Les parcours natifs ne dépendent plus de minuit (`DEMO_NEXT_DAY_SESSION`).
- **Barre fixée en bas du constructeur.** Elle couvre le bas de l'écran : un parcours qui glisse doit centrer sa destination.

## 3. État des lieux au 16 novembre 2026

### En production

- **Déploiement.** `app.tartan.coach` et `tartan.coach` (Vercel, Neon Launch, Mux, Resend, Stripe, OpenAI, Sentry) servent `df446d0`. Aucune erreur d'exécution sur 24 h au 16 novembre.
- **Inscriptions.** Les inscriptions publiques sont **fermées**. Seul le fondateur les ouvre. Le jeu du site est retiré depuis le 23 novembre 2026.
- **Preview.** `preview.tartan.coach` tourne sur une base `preview` qui ne contient que la graine de démonstration.
- **Lots du 15 novembre.** Les lots 1 à 4 sont fusionnés, ou en cours de fusion au moment de ce brief : PR 143 à 149, plus la 148 pour le constructeur mobile et Maestro Android. La PR 150 prépare les bêtas et le corpus IA, sans code produit.
- **Sauvegardes.** Une sauvegarde chiffrée part chaque nuit vers un store privé. La restauration a été chronométrée.

### Ce qui marche, et à quel niveau

| Fonction | Niveau | À savoir |
| --- | --- | --- |
| Connexion : lien magique, mot de passe, Google et Apple | Testé ; lien magique éprouvé sur Gmail | Le mot de passe existe déjà mais reste caché derrière « Utiliser un mot de passe ». Aucun réglage pour le définir ou le changer (voir 4.1) |
| Espaces, invitations, rôles | Testé | Aucune invitation jouée de bout en bout par une vraie personne. Outlook et iCloud non éprouvés |
| Constructeur de séance web : circuits, supersets, groupes à deux niveaux, glisser-déposer à la poignée, séries détaillées, remplacement en autonomie | Testé ; recette en production le 15 novembre | Maquette validée par le fondateur le 14 novembre |
| Mode séance : minuteur sur l'horloge, enchaînement, vibration, écran allumé | Testé ; joué en production | — |
| Suivi du coach, statuts, relances | Testé | Échéance comptée à Paris depuis le lot 3 |
| Catalogue : 173 fiches (150 relues par le fondateur, 23 variantes à relire) | Testé ; compté en production | Guides marqués « consignes indicatives » |
| Gestes animés : 173 sur 173 (156 de profil, 15 de face, 1 de dos, 1 de profil dans la série de face) | Testé (tests de boucle, de positions, de sol) | **Aucune famille validée par le fondateur.** Précision insuffisante (voir 4.5) |
| Planificateur IA, deux modes | Testé avec un prestataire simulé ; un parcours réel | **Non qualifié.** Corpus du fondateur à écrire (40 consignes, 30 dictées) |
| Vidéo collaborative : envoi athlète et coach, remarques horodatées, tracés (ligne, flèche, angle, cercle), partage au groupe, quotas par athlète | Testé ; éprouvé sur Mux en production le 15 novembre | Pas de plein écran (voir 4.4) |
| Charges, records, progression, phases | Testé ; partiellement éprouvé | — |
| Abonnements Stripe | Testé ; six essais sandbox réels | Aucun vrai paiement. Retour vers Tartan après paiement non prouvé |
| Notifications, e-mails | Testé ; Gmail éprouvé | Aucun push reçu sur un téléphone |
| Hors ligne, PWA | Testé | Pas éprouvé au stade |
| Mobile natif (Expo) | Testé ; Maestro iOS et Android sur simulateur et émulateur | Aucun téléphone physique. Build iOS 14 envoyé à App Store Connect le 15 novembre, pas encore installé par le fondateur |

La matrice des écrans (`apps/web/e2e/screens.ts`, 74 pages au 15 novembre) balaie chaque page pour les rôles visiteur, coach et athlète, à trois largeurs, avec axe. **Une nouvelle page doit y entrer**, sinon un test échoue.

### Défauts déjà connus, à confirmer et corriger pendant l'audit

1. **Gestes en haltérophilie** : enchaînements faux, disque sous le sol, genoux en hyperextension, aucune accélération (détail en 4.5).
2. **Calendrier** : retour visuel du glisser-déposer quasi nul. Aucune alternative au clavier en vue Mois. Pas de glisser au doigt (détail en 4.2).
3. **Écran à 386 px** : le sélecteur d'espace de l'en-tête n'affiche aucun nom.
4. **Lecteur vidéo** : aucun raccourci clavier. Sous 1024 px, l'éditeur passe sous la vidéo et on la perd de vue en tapant.
5. **Lecteurs de gestes (web et mobile)** : ils refont tout le rendu React à chaque image (`setState` dans `requestAnimationFrame`).
6. **Mot de passe hors parcours** : un compte créé par lien magique ne peut se donner un mot de passe que par « mot de passe oublié », un détournement.
7. **Lien de connexion** : la redirection vers `/connexion` perd la page d'origine (pas de paramètre `next`).
8. **Textes en dur hérités** : 267 textes encore gelés dans `apps/web/eslint-suppressions.json`. Vide la base au fil des fichiers touchés.
9. **`DESIGN.md` n'a plus de section sur le logo** depuis le commit `6bc2f40`. `icon-maskable-512.png` et `splash.png` ne sont plus produits par `scripts/build-logo.mjs`.
10. **Tracés vidéo** : on ne peut les poser qu'au pointeur, pas au clavier. Ils sont en lecture seule sur le mobile.

## 4. Les demandes du fondateur

Chaque demande décrit l'existant (avec fichiers), le résultat attendu et le critère de fin. Le fondateur a validé ces ajouts au périmètre le 16 novembre (voir `PRODUCT.md`).

### 4.1 Connexion par mot de passe, pour le coach comme pour l'athlète

**Demande.** Aujourd'hui, un coach s'inscrit et se connecte par un lien reçu par e-mail. Un athlète invité rejoint l'espace par le lien d'invitation. Le fondateur veut que chacun puisse aussi **définir son propre mot de passe**, puis se reconnecter après une déconnexion, au choix par le lien ou par ce mot de passe.

**Existant.**
- **Configuration** (`apps/web/src/lib/auth.ts`, Better Auth 1.7.15) :
  - `emailAndPassword` est déjà actif : adresse vérifiée exigée, 10 caractères au minimum ; une réinitialisation révoque les sessions et envoie `PasswordChangedEmail` ;
  - plugins `magicLink` (15 min, jeton haché), `passkey` (réservé à l'élévation de la console d'administration), `expo` ;
  - limites de débit : `/sign-in/*` 10 par minute, `/sign-up/*` et `/magic-link/*` 5 par minute ;
  - session glissante de 30 jours.
- **Formulaire de connexion** (`src/features/auth/sign-in-form.tsx`) :
  - trois modes : lien magique par défaut, mot de passe derrière « Utiliser un mot de passe », inscription par mot de passe ;
  - l'inscription d'un coach passe par `/connexion?creer=1`, seulement si `signupMode === "public"`.
- **Pages et parcours** :
  - `/mot-de-passe-oublie` et `/nouveau-mot-de-passe` existent ;
  - invitation : `/i/[token]` montre le formulaire de connexion (e-mail prérempli), puis `AcceptForm` ;
  - `/reglages` : déconnexion, révocation des autres sessions, suppression du compte. **Aucun réglage de mot de passe.**
- **Mobile** : `apps/mobile/app/(auth)/sign-in.tsx` propose déjà le lien et le mot de passe ; `settings.tsx` n'a pas de réglage de mot de passe.

**Attendu.**
1. **Connexion.**
   - Le lien et le mot de passe deviennent deux chemins de même rang, lisibles d'un coup d'œil, sans mode caché.
   - Recommandation : l'e-mail d'abord, puis « Continuer avec mon mot de passe » ou « Recevoir un lien de connexion ». Les erreurs disent quoi faire, sans révéler si un compte existe.
   - Google et Apple restent proposés quand ils sont configurés.
2. **Inscription du coach.**
   - Le coach peut choisir un mot de passe dès l'inscription.
   - L'adresse doit toujours être vérifiée avant la première connexion par mot de passe. Garde-le, avec un écran d'attente clair.
3. **Athlète invité.**
   - Sur `/i/[token]`, il crée son compte par lien ou par mot de passe.
   - S'il est entré par le lien, l'accueil lui propose ensuite, en une étape facultative et refermable, de définir un mot de passe.
   - Respecte la promesse des « 10 secondes » côté athlète : rien ne bloque l'arrivée dans la séance.
4. **Réglages, rubrique « Connexion ».**
   - « Définir un mot de passe » quand le compte n'en a pas : `setPassword` est réservé au serveur dans Better Auth, il passe donc par un service qui exige une session récente ou une confirmation par e-mail.
   - « Changer le mot de passe » : le mot de passe actuel est demandé, avec l'option de déconnecter les autres appareils.
   - L'état des méthodes du compte : lien, mot de passe, Google, Apple.
   - Un e-mail prévient à chaque définition et à chaque changement.
5. **Retour après connexion.** Après une connexion, on revient à la page demandée : paramètre `next`, limité aux chemins relatifs internes.
6. **Mobile.** Mêmes réglages et même ordre des choix, une fois le web fait. Les contrats et l'API sont communs dès ce lot.

**Critère de fin.** Parcours Playwright :
- un coach s'inscrit avec un mot de passe, vérifie son adresse, se déconnecte, puis se reconnecte par mot de passe, puis par lien ;
- un athlète invité entre par le lien, définit son mot de passe à l'accueil, se déconnecte, puis se reconnecte des deux façons ;
- un compte sans mot de passe en définit un depuis les réglages ;
- un mot de passe se change, et un mauvais mot de passe actuel est refusé ;
- les limites de débit sont tenues ;
- tout cela passe axe à 390 px.

Mets à jour [../reference/onboarding.md](../reference/onboarding.md) et [../reference/emails.md](../reference/emails.md).

### 4.2 Planning : un glisser-déposer qui se voit et se sent

**Demande.** Quand le coach fait glisser une séance vers une autre colonne du planning, rien n'indique la colonne survolée : pas de surbrillance, pas de pointillés, pas d'animation. Le geste manque de retour.

**Existant.**
- **Page** : `/calendrier`, avec les vues Semaine, Mois et Liste.
- **Vue Semaine** (`src/features/sessions/calendar-board.tsx`) :
  - glisser-déposer HTML5 natif (`draggable`, `dataTransfer`, `onDragOver`, `onDrop` → `moveSessionAction`) ;
  - le seul retour est le curseur `grab` et l'image fantôme du navigateur ;
  - après le dépôt, `router.refresh()`, sans mise à jour optimiste ;
  - les boutons « Déplacer » et « Dupliquer » ouvrent une date (alternative WCAG 2.5.7).
- **Vue Mois** (`month-grid.tsx`) :
  - glisser-déposer sur ordinateur seulement ;
  - aucune alternative au clavier.
- **Partout** : HTML5 ne marche pas au doigt, et le mouvement réduit n'est pas traité.
- **Modèle déjà présent dans le dépôt** : le constructeur (`src/features/sessions/sequence-editor.tsx`, `useSequenceDrag`) fait déjà mieux :
  - pointeur capturé, souris comme doigt ;
  - fantôme qui suit le pointeur ;
  - ligne de dépôt ;
  - source atténuée ;
  - défilement près des bords ;
  - Échap pour annuler ;
  - annonces `aria-live`.

**Attendu.**
- **Une seule mécanique.** Factorise le glisser du constructeur en un crochet partagé, et utilise-le dans le planning. Pas de nouvelle bibliothèque.
- **Pendant le glisser.**
  - La carte d'origine s'atténue et laisse sa place en pointillés.
  - Un aperçu de la carte suit le pointeur, légèrement soulevé : aplat et contour, pas d'ombre lourde.
  - La colonne ou la case survolée s'éclaire : fond teinté et contour en pointillés, tirés des jetons.
  - Un repère montre où la séance va se ranger dans la journée.
  - Une case interdite (passé verrouillé, droits insuffisants) le dit, sans dépendre de la couleur seule.
- **Au dépôt.**
  - La carte se pose avec la courbe « réception » (260 ms au plus) et la date change tout de suite (mise à jour optimiste).
  - En cas d'échec, elle revient à sa place avec un message clair.
  - Le changement est annoncé aux lecteurs d'écran.
- **Au clavier**, partout, vue Mois comprise : « Déplacer » et « Dupliquer », et, si tu le juges utile, flèches avec une touche de saisie.
- **Au doigt** : appui long pour saisir, défilement automatique près des bords, sur la vue Semaine en téléphone comme sur la vue Mois.
- **Mouvement réduit** : aucun déplacement animé, mais la surbrillance et les pointillés restent (ce sont des états, pas des animations).

**Critère de fin.**
- Parcours Playwright : glisser à la souris et au toucher en Semaine et en Mois ; alternative au clavier en Mois ; échec serveur qui remet la carte en place ; mouvement réduit contrôlé par `expectNoMotion`.
- Captures avant et après, à 390 et 1440 px.

### 4.3 Banque d'exercices : listes du coach, fiches à lui, fiches plus claires

**Demande.** La bibliothèque commune reste le « pot commun » d'exercices disponible pour tous. Chaque coach doit pouvoir :
- mettre des exercices en favoris ;
- se créer ses propres listes (ses banques), que les autres utilisateurs ne voient pas ;
- y ranger des exercices de la banque commune ;
- y créer des exercices nouveaux.

Les descriptifs et les visuels des fiches doivent devenir très clairs et concis à la fois.

**Existant.**
- **Modèle `Exercise`** :
  - `organizationId` à `null` désigne une fiche du catalogue commun ; sinon, la fiche appartient à l'espace ;
  - autres champs : `catalogKey`, `sourceCatalogKey` (copie issue du catalogue), `guide` (JSON : objectif, mise en place, étapes, respiration, erreurs, variantes, illustration), `cues` (5 consignes de 120 signes), `aliases`, `tags`, `createdBy`, `deletedAt`.
- **Ce qui n'existe pas** :
  - **aucun modèle** de liste, de collection ou de favori ;
  - aucune fiche propre à un coach : la visibilité s'arrête à l'espace.
- **Bibliothèque** (`/exercices`, `src/features/exercises/exercise-library.tsx`) :
  - filtres « Tous / Commun / Mes exercices », famille, catégorie ;
  - une fiche commune n'a ni « Modifier » ni « Personnaliser ». Les copies du catalogue ne se créent qu'à la création d'un espace (`STARTER_LIBRARY`).
- **Guide** : le coach ne peut pas le modifier (`exerciseInput` ne le contient pas). En revanche, une copie renommée garde son guide (`retainedExerciseGuide`).
- **Sélecteur du constructeur** : il cherche dans toute la bibliothèque ; il a des familles et des récents.

**Attendu.**

**Données.** Deux tables additives, servies par un service qui appelle `requireOrgMember`.
- `ExerciseList` : espace, propriétaire, nom, ordre, date.
- `ExerciseListItem` : liste, exercice, ordre, date d'ajout.
- **Visibilité** :
  - une liste appartient à son coach : ni les autres coachs ni les athlètes ne la voient ;
  - **à faire confirmer par le fondateur** : faut-il pouvoir partager une liste avec les autres coachs du même espace ? Par défaut, non.
- **Favoris** : une liste système « Favoris » par coach, alimentée par une étoile sur chaque fiche.
- **Fiches** : une fiche créée par le coach reste rattachée à l'espace, pour que les séances et les adjoints puissent la lire. Les autres espaces ne la voient jamais. Ne rends pas une fiche invisible des athlètes à qui elle est prescrite.

**Gestes du coach.**
- Mettre une fiche en favori d'un geste.
- Ajouter une fiche, commune ou à lui, à une ou plusieurs listes : depuis la fiche, depuis la bibliothèque et depuis le sélecteur du constructeur.
- Créer, renommer, réordonner et supprimer une liste. Retirer une fiche d'une liste.
- « Personnaliser » une fiche commune : une copie dans l'espace qui garde le guide et le geste, puis s'édite.
- « Créer un exercice » directement dans une liste.

**Filtres.**
- La bibliothèque et le sélecteur du constructeur proposent « Favoris » et chaque liste à côté des familles.
- Le planificateur peut, en option, privilégier les fiches des listes du coach. Mesure-le avant de l'activer.

**Fiche plus claire et concise.**
- Refonds la mise en page de la fiche : `/exercices/[id]`, aperçu dans le constructeur, guide vu par l'athlète en séance.
- Le geste animé en premier.
- Une phrase d'objectif, la mise en place en une ligne, trois ou quatre étapes courtes, deux ou trois erreurs à éviter.
- Les variantes plus facile et plus difficile en liens vers leur fiche quand elle existe.
- Muscles ou qualités travaillés si la donnée existe ; ne l'invente pas.
- Propose des règles de longueur, par exemple 90 signes par étape, et applique-les au catalogue.
- **Toute réécriture d'un guide déjà relu repasse en relecture du fondateur** : présente les changements en lot, par famille, avec un avant et après.

**Guide de sa copie.** Un coach peut compléter le guide de sa copie : consignes, étapes, erreurs. Il ne le perd pas en renommant la fiche.

**Mobile.** Mêmes listes et mêmes favoris dans le lot de parité mobile, et une API commune dès ce lot.

**Critère de fin.**
- Tests de service, droits compris : un autre coach du même espace, un athlète et un autre espace ne voient pas la liste.
- Parcours Playwright : favori, création de liste, ajout depuis le catalogue, création dans une liste, filtre dans le sélecteur du constructeur, puis séance publiée avec une fiche de la liste.
- La matrice des écrans est mise à jour.

### 4.4 Vidéo : plein écran, éditeur toujours à portée

**Demande.** Pouvoir passer la vidéo en plein écran tout en gardant l'éditeur : remarques, tracés, commentaires. Sur ordinateur, en panneau latéral ou en bas, selon ce qui est le meilleur choix d'UX. Le comportement doit aussi être adapté au téléphone.

**Existant.**
- **Lecteur** (`src/features/videos/video-analysis.tsx`) :
  - `<video>` natif sans contrôles, MP4 signé avec repli HLS ;
  - image par image, vitesses de 0,1 à 1, boucle A-B, frise avec phases et repères de remarques ;
  - tracés en calque SVG (`video-drawing.tsx`) ;
  - remarques horodatées et fil de commentaires.
- **Mise en page** :
  - à partir de 1024 px, la vidéo est à gauche et un panneau de 360 px à droite ;
  - en dessous, tout s'empile ;
  - la page reste encre, comme le veut `DESIGN.md`.
- **Plein écran** : aucun, ni sur le web ni sur le mobile (`apps/mobile/app/video/[id].tsx`, `expo-video`, tracés en lecture seule).
- **Clavier** : aucun raccourci.

**Attendu (recommandation, à confirmer par ton audit).**
- **Ordinateur.**
  - Un bouton « Plein écran », et la touche F, mettent **tout l'espace d'analyse** en plein écran (Fullscreen API sur le conteneur, pas sur `<video>`) : la vidéo occupe la scène, l'éditeur reste en **panneau latéral à droite**.
  - Pourquoi à droite : les vidéos d'athlètes sont souvent filmées en portrait, ce qui laisse de la place sur les côtés, et un panneau en bas mangerait la hauteur dont un geste a besoin.
  - Le panneau se replie en un rail fin. On peut l'élargir.
  - La frise et les contrôles restent sous l'image.
  - Échap sort du plein écran.
  - Sans prise en charge de la Fullscreen API, le même agencement se déploie en surcouche fixe sur toute la fenêtre.
- **Téléphone.**
  - Sur iPhone, Safari ne met en plein écran que l'élément `<video>` : utilise un mode immersif en surcouche fixe (`100dvh`, zones sûres respectées).
  - En portrait : la vidéo en haut, l'éditeur dans une feuille en bas à trois hauteurs (rail avec la frise, moitié, plein). « Ajouter une remarque » met en pause et ouvre la feuille à moitié, sans jamais masquer l'instant commenté.
  - En paysage : panneau latéral, comme sur ordinateur.
- **Raccourcis**, annoncés dans une aide accessible et sans conflit avec la saisie :
  - espace : lecture ou pause ;
  - flèches : image par image ;
  - F : plein écran ;
  - M : remarque à l'instant courant.
- **Sous 1024 px, hors plein écran** : la vidéo reste visible, collée en haut, pendant qu'on écrit.
- **Mobile natif** (lot de parité) : plein écran `expo-video` avec la même feuille, et création de tracés au doigt.

**Critère de fin.**
- Parcours Playwright : entrer et sortir du plein écran, poser une remarque et un tracé en plein écran, raccourcis clavier, axe dans les deux états, mouvement réduit.
- Captures à 390 px en portrait et en paysage, à 768 et à 1440 px.

### 4.5 Gestes des exercices : placements justes, vraie dynamique, personnage plus fin

**Demande.** Les mouvements de profil et de face ne sont pas assez précis, ni dans les placements, ni dans la dynamique : il n'y a par exemple aucune accélération dans les mouvements d'haltérophilie. Le petit personnage est peut-être aussi trop grossier.

**Existant, mesuré le 16 novembre dans `packages/mascot`.**
- **Squelette** (`skeleton.ts`).
  - 10 angles : buste, tête, épaule et coude de chaque bras, hanche et genou de chaque jambe.
  - Il manque le poignet, la cheville, les orteils, le cou, l'omoplate et le bassin. La colonne est faite d'un seul bloc.
  - Le pied est soudé au tibia : en squat, le talon semble décoller ou s'enfoncer.
- **Proportions** : tête de 88 unités pour 316 de haut, soit environ 3,6 têtes, une silhouette de dessin animé. Les bras sont courts : une barre au sol demande une forte flexion du buste.
- **Découpage d'un geste** (`exercise.ts`) : quatre positions, une par ligne du guide, chacune sur un quart de la boucle, tenue pendant 45 % de son créneau. Les clés `via` s'insèrent **après** la tenue, vers la position suivante.
- **Interpolation** (`clip.ts`) : une spline Catmull-Rom sur chaque angle, avec un dépassement voulu.
  - **Aucune courbe d'accélération par phase.** La première tirée, la seconde tirée et le passage sous la barre vont à la même vitesse.
  - Les tenues dérivent : jusqu'à 5° de buste pendant « l'immobilité » de l'arraché.
- **Défauts en haltérophilie** (`exercises/weightlifting.ts`).
  - À l'arraché, le passage aux genoux est placé après l'extension : le corps se replie, bras pendants, puis la barre fait une boucle de 75 unités devant le corps.
  - L'épaulé-jeté passe du sol directement au squat, et la barre « saute » en rack.
  - Même défaut sur l'arraché en puissance, l'épaulé en puissance, l'arraché musclé, le jeté poussé et le développé poussé. Le jeté fendu est juste.
- **Défauts de placement**, sur de nombreux gestes.
  - Le disque passe sous le sol, de 4 à 11 unités (arraché, épaulé, soulevés de terre, tirages).
  - Le genou se met en hyperextension, jusqu'à −11° (arraché, épaulé, squat jump, fente bulgare, montée sur box, équilibre d'arraché, poussée au mur…).
  - Le bras dépasse sa cible, jusqu'à 213°.
- **Barre.** Elle n'est tenue que par la main A. Arraché et épaulé ont la même prise : la largeur de prise ne se voit pas de profil.
- **Contacts.** Un seul appui est fixé, et seulement quand il ne change pas entre deux clés ; le second pied et les mains glissent. Aucune cinématique inverse, en dehors de `settle()` (une bissection sur un paramètre, aux clés seulement).
- **Tests.** Ils ne vérifient que les points articulaires au-dessus du sol. Rien sur les accessoires, la trajectoire de barre, les limites articulaires ou le glissement des pieds.
- **Lecteurs** : ils refont tout le rendu React à chaque image.
- **Relecture** : `motionFamilies` dans `PlatformSetting`, par famille et par « famille:face ». **Aucune famille n'est validée** : tout s'affiche « Illustration de travail ».

**Attendu.**
1. **Moteur.**
   - **Articulations.** Ajoute la cheville avec un pied talon-pointe, le poignet, et une colonne en deux ou trois segments avec le bassin.
   - **Cinématique inverse à deux os** pour fixer pieds et mains pendant toute une transition, pas seulement aux clés : les deux pieds au sol restent au sol, et les deux mains sur la barre restent sur la barre.
   - **Timing par transition** : une durée et une courbe propres à chaque transition, nommées comme les jetons (élan, impulsion, réception), et une clé de tenue vraiment immobile.
   - **Trajectoire imposée** des accessoires : la barre suit un chemin donné, proche du corps et presque vertical, et les bras la rejoignent par cinématique inverse.
   - **Sémantique des clés `via`** : rends-la explicite (« avant » ou « après » la tenue) et corrige tous les gestes concernés.
   - **Contraintes vérifiées par les tests**, sur chaque image de chaque geste :
     - limites articulaires, sans hyperextension ;
     - rien sous le sol, accessoires compris ;
     - pieds d'appui qui ne glissent pas ;
     - trajectoire de barre dans une enveloppe autour du corps.
2. **Dynamique par famille.**
   - **Haltérophilie** : première tirée contrôlée, seconde tirée explosive, passage sous la barre très rapide, réception amortie, redressement contrôlé.
   - **Pliométrie** : temps de contact court, envol en parabole.
   - **Musculation** : excentrique lente, concentrique plus rapide.
   - **Course et éducatifs** : cadence réaliste.
   - **Gainage et mobilité** : tenues franches.
   - **Sources** : appuie chaque choix sur des sources techniques reconnues (fédérations, manuels d'entraîneur), citées dans la PR, jamais recopiées.
3. **Personnage.**
   - Propose une morphologie plus athlétique et plus fine : environ 6 à 7 têtes, membres affinés, mains et pieds dessinés, articulations lisibles.
   - **Garde l'identité du groupe** : six athlètes, teints, coiffures, tenues, dossard, aplats sans contour, règles Oklab de `packages/design-tokens/src/athletes.ts`.
   - `DESIGN.md` impose **une seule morphologie** partagée par le site, le film d'accueil, les e-mails et les guides. Une nouvelle morphologie s'applique donc partout. Vérifie tous les usages (`grep @tartan/mascot`, environ 40 fichiers, plus les PNG d'e-mail régénérés par `pnpm --filter @tartan/web email:athletes`).
   - **Validation du fondateur avant de généraliser.** Montre-lui d'abord un prototype sur une planche :
     - trois gestes : arraché de profil, squat de profil, fente latérale de face ;
     - ancien et nouveau côte à côte, en mouvement et en frise ;
     - au besoin, la page d'accueil avec la nouvelle morphologie.
4. **Performance.** Lecteurs sans rendu React à chaque image : attributs mis à jour directement, ou animation calculée hors de l'arbre React. Sans bibliothèque d'animation sauf décision.
5. **Relecture.**
   - Un geste refait repasse « de travail » : nouvelle série dans `MOTION_BATCHES`, ou remise à zéro des familles concernées.
   - Prépare pour le fondateur une planche par famille dans `/admin/mouvements`.
   - Ordre de production : haltérophilie, musculation de base, pliométrie, puis le reste.

**Critère de fin.**
- Les tests de contraintes passent sur les 173 gestes.
- Le prototype est validé par le fondateur.
- Toutes les familles sont refaites et présentées en relecture.
- Le rendu est contrôlé à 390 px et en mouvement réduit.
- Les PNG d'e-mail sont vérifiés.

### 4.6 Logo Tartan : plus fort, reconnaissable en tout petit

**Demande.** Le logo actuel, un carré rouge avec des lignes de couloir et une ligne d'arrivée, est trop basique. On le reconnaît mal sur l'App Store et dans l'onglet de Chrome. Il faut quelque chose de plus fort et de plus reconnaissable.

**Existant.**
- **Icône** (`apps/web/public/brand/icon.svg`) :
  - carré rouge piste à coins arrondis ;
  - cinq lignes blanches horizontales de 3 px ;
  - une ligne d'arrivée verticale ;
  - les numéros de couloir 1 à 4 en corps 26. La version réduite n'a pas de numéros.
- **Logotype** : l'icône suivie de « Tartan », en Barlow Condensed Bold.
- **Génération** :
  - `scripts/build-logo.mjs` produit les SVG et les PNG : favicon, icônes 32, 180, 192 et 512, logo d'e-mail, iOS 1024, Android adaptatif, Play 512, notification 96 ;
  - `icon-maskable-512.png` et `splash.png` ne sont plus produits par le script ;
  - `og.png` est une capture de la page d'accueil.
- **Règles** : `DESIGN.md` n'a plus de section sur le logo.

**Attendu.**
1. **Directions.**
   - Propose trois ou quatre directions, chacune sur une planche : une forme simple et forte, lisible à 16 px, ancrée dans le monde de la piste sans le répéter littéralement.
   - Pistes possibles : un monogramme « T » construit par les couloirs ou un virage, une silhouette de virage, la planche d'appel.
   - Pour chaque direction, montre :
     - l'onglet de Chrome en clair et en sombre, à 16 et 32 px ;
     - l'écran d'accueil iOS au milieu d'autres icônes ;
     - la grille de l'App Store ;
     - l'icône adaptative Android (zone sûre de 66 %, formes rondes et carrées) ;
     - l'icône teintée ou monochrome (iOS 18, icônes à thème d'Android 13) ;
     - la notification en silhouette blanche ;
     - le logotype complet sur la piste, l'encre et la craie.
   - Écarte toute ressemblance avec une marque existante du sport.
2. **Choix.** Le fondateur choisit. Tu n'appliques rien avant.
3. **Déploiement.**
   - `build-logo.mjs` génère **tous** les fichiers : favicon SVG et PNG, maskable, splash, iOS, Android adaptatif et monochrome, Play, notification, e-mail, Open Graph refait.
   - Mets à jour le manifeste, `app.config.ts` et les e-mails.
   - Ajoute à `DESIGN.md` une section « Logo » : formes, zone de protection, tailles minimales, fonds permis, interdits.
   - Les icônes natives changent avec le prochain binaire : note-le dans `ETAT.md`.

**Critère de fin.**
- Planche validée par le fondateur.
- Tous les fichiers régénérés par le script, avec un test qui vérifie la présence et les dimensions de chaque fichier.
- Rendu contrôlé dans un vrai onglet et sur le simulateur iOS.

### 4.7 Audit général et améliorations

Au-delà des demandes ci-dessus, le fondateur veut **améliorer toutes les fonctions**. Ton audit couvre chaque route de `apps/web/app` :

- **Coach** :
  - `/suivi`, `/calendrier` ;
  - `/seances/nouvelle`, `/seances/[id]`, `/seances/[id]/suivi`, `/seances/[id]/charges`, `/seances/[id]/athletes/[athleteId]/series` ;
  - `/exercices`, `/athletes`, `/videos`, `/annonces`, `/planificateur`, `/phases`, `/analyse`, `/historique/[athleteId]`, `/outils/charges`, `/reglages`, `/abonnement`, `/admin/*`.
- **Athlète** :
  - `/aujourdhui`, `/seance/[id]`, `/seance/[id]/mode`, `/seance/[id]/series` ;
  - `/progres`, `/mes-videos`, `/calendrier`, `/annonces`, `/notifications`, `/nouveautes`, `/reglages`, `/synchronisation`.
- **Public** :
  - `/` (film), `/connexion`, `/bienvenue`, `/i/[token]` ;
  - mot de passe oublié, tarifs, aide, contact, pages légales, hors ligne.

Pour chaque écran, note :
- les frictions du parcours réel, en comptant les gestes de la tâche principale ;
- les écarts à `DESIGN.md` ;
- l'accessibilité (clavier, lecteur d'écran, zoom 200 %, contraste) ;
- les états : chargement, vide, erreur, contenu long, 30 et 120 athlètes ;
- les performances (LCP, INP, poids des scripts) ;
- la justesse des chiffres affichés.

Mesure le temps de validation côté athlète : la promesse est 10 secondes.

**Livrable de l'audit**, avant tout code des lots 4.1 à 4.6 :
- Une section « Constats de l'audit » ajoutée **en bas de ce document** : défauts classés par gravité (bloquant la vente, gênant, finition), avec écran, preuve (capture hors dépôt ou test) et correction proposée.
- Puis une liste de lots ordonnée.

Tu n'attends pas de validation pour corriger les défauts : tu enchaînes.

## 5. Ordre conseillé des lots

1. **Audit**, document seul (une PR de documentation, qui saute Maestro).
2. **Connexion par mot de passe** (4.1), web d'abord. Contrats et API partagés.
3. **Glisser-déposer du planning** (4.2), web seul.
4. **Vidéo en plein écran** (4.4), web seul.
5. **Listes et favoris d'exercices, fiches plus claires** (4.3). Réécriture des guides présentée au fondateur.
6. **Logo** (4.6) : planche, choix du fondateur, puis déploiement.
7. **Personnage et gestes** (4.5) : moteur et tests de contraintes, prototype, validation, puis production famille par famille.
8. **Corrections de l'audit**, par lots cohérents.
9. **Recette web complète** : matrice des écrans, 14 parcours obligatoires, Preview, e-mails, Stripe sandbox jusqu'au retour vers Tartan. `ETAT.md` est mis à jour pour la décision d'ouverture du fondateur.
10. **Parité mobile** des lots 2 à 7, puis reprise des bêtas iOS et Android ([ios.md](ios.md), [android.md](android.md), [../reference/betas.md](../reference/betas.md) quand la PR 150 est fusionnée).

Les lots 2, 3 et 4 ne touchent pas les mêmes fichiers. Tu peux les mener en parallèle dans des worktrees séparés, mais fusionne-les **l'un après l'autre**, chacun mis à jour sur `main`.

## 6. Ce qui reste au fondateur, et qui ne te revient pas

- **TestFlight** : installer le build iOS 14 sur son iPhone et rejouer une séance d'athlète.
- **Sentry** : créer un jeton Sentry et le poser sur EAS. Tu retireras ensuite `SENTRY_DISABLE_AUTO_UPLOAD`.
- **OpenAI** : poser un plafond de dépense mensuel sur le projet.
- **Passkey de secours** : la créer sur un second appareil. Tu retireras ensuite `ADMIN_BOOTSTRAP_TOKEN` de Vercel.
- **Google Play** : recevoir le D-U-N-S, puis créer le compte organisation.
- **Relectures** :
  - les 23 guides de la version 5 ;
  - les gestes, famille par famille et vues de face ;
  - les guides que tu réécris.
- **Corpus du planificateur** : 40 consignes et 30 dictées, jamais vues par un agent.
- **Recettes réelles** : paiement réel accompagné, e-mails sur Outlook et iCloud, essais sur ses téléphones, pilote sans guidage.
- **Ouverture** : décider de l'ouverture des inscriptions, puis surveiller 72 heures avec toi.

**Questions à lui poser au bon moment, sans bloquer le reste :**
1. Une liste d'exercices peut-elle être partagée avec les autres coachs du même espace ?
2. Les guides réécrits plus courts remplacent-ils les guides relus, ou s'affichent-ils en résumé au-dessus ?
3. Quelle direction de logo choisit-il ?
4. Le prototype du personnage est-il validé ?
5. Si tu juges nécessaire une bibliothèque d'animation, l'accepte-t-il ?

## 7. Ce qu'on attend à la fin

- Une web app où chaque écran a été audité, corrigé et rendu à trois largeurs, avec les six demandes livrées.
- Chaque fonction a son niveau de preuve écrit dans `ETAT.md`.
- Une CI verte et une production sans erreur sur 24 h après chaque fusion.
- Un compte rendu au fondateur, en français, qui sépare ce qui est codé, ce qui est testé et ce qui est éprouvé, et ce qui l'attend, lui.

---

## 8. Constats de l'audit (17 novembre 2026)

Audit mené sur `main` à `072eafd`, sur une base locale dédiée (graine, puis `demo:fill`, puis 110 athlètes ajoutés pour l'essai de volume). Les captures et les rapports sont gardés hors du dépôt.

### 8.1 Ce qui a été fait

| Passe | Périmètre | Résultat brut |
| --- | --- | --- |
| Balayage outillé | 81 écrans (19 publics, 26 coach, 18 athlète, 18 console), à 390, 768 et 1440 px, en mouvement réduit, sur données remplies | axe : 0 violation ; console : 0 erreur ; aucun texte sous 12 px ; 1 débordement |
| Parcours rejoués dans le navigateur | Coach neuf jusqu'à la première séance publiée ; athlète invité jusqu'à la validation ; planificateur (prestataire simulé) ; calendrier ; bibliothèque et fiche ; réglages | 22 étapes capturées à 390 px, gestes comptés |
| Volume | 121 athlètes dans un groupe | `/suivi` et `/athletes` mesurés |
| Performance | Build de production local, téléphone émulé, processeur ralenti quatre fois | LCP et poids par page |

**Limites.** Le zoom à 200 % n'a pas été mesuré à part (la largeur de 768 px s'en approche sur ordinateur). La limitation du réseau n'a pas pris pendant la mesure de performance : les LCP sont ceux d'un bon réseau. Les lecteurs d'écran n'ont pas été essayés. Le planificateur n'a reçu aucun appel réel pendant l'audit.

### 8.2 Ce qui tient

- **Accessibilité automatique** : aucune violation axe sur les 81 écrans, aux trois largeurs, données remplies.
- **Validation de l'athlète** : un seul geste (« J'ai fait la séance ») depuis l'écran du jour, puis une feuille facultative. La promesse des 10 secondes est tenue.
- **Mode séance** : lisible, une étape par écran, minuteur à portée de pouce.
- **Performance perçue** : LCP de 0,2 à 1,6 s sur toutes les pages mesurées, aucun décalage de mise en page (CLS 0).

### 8.3 Défauts bloquant la vente

| N° | Écran | Constat | Preuve | Correction |
| --- | --- | --- | --- | --- |
| B1 | `/suivi` d'un coach neuf | Après la création de l'espace, le coach arrive sur une grille vide et quatre liens. Aucune présentation des fonctions, aucun état gardé, impossible de refermer ou de rouvrir le guide. Le lien « Inviter des athlètes » vise `/reglages#invitations`, qui est la section des groupes, pas le formulaire d'invitation | Parcours, étape 9 ; `suivi/page.tsx` | Lot G |
| B2 | `/connexion?creer=1` | Sous le titre « Crée ton espace coach », l'inscription par mot de passe demande deux clics cachés (« Utiliser un mot de passe », puis « Pas encore de compte ? ») et l'action principale affichée reste « Se connecter ». 19 gestes de l'arrivée à l'espace créé | Parcours, étapes 2 à 8 | Corrigé au lot C |
| B3 | `/aujourdhui` d'un athlète neuf | Un jour de séance, l'athlète n'a aucun accueil et la proposition d'installation n'est jamais armée. L'accueil vit dans le navigateur : il revient sur un autre appareil | Parcours, étape 22 ; `athlete-welcome.tsx` | Lot G |
| B4 | `/planificateur` | « Continuer avec ces destinataires » demande deux clics : le premier charge le contexte sans avancer. Vocabulaire technique (« Consommation et fuseau de l'espace », « Contexte prêt », « Exercices autorisés pour cette proposition »). Trois blocs d'avertissement et une case « relu » avant de pouvoir envoyer. Le mode se choisit dans une liste déroulante. S'y ajoutent les défauts lus dans le code : appel bloquant sans retour à l'écran, erreurs du prestataire écrasées en un message générique, mode « Proposer » sans contexte, « Ajuster » qui refait une autre séance | Parcours rejoué ; `web-planner.tsx`, `provider.ts`, `context.ts` | Lot H |
| B5 | Fiche d'exercice | À l'arraché, le personnage est replié sur lui-même, tête démesurée, la barre réduite à un disque dans une main. Toutes les fiches portent « Illustration de travail » | Capture de la fiche | Lot J |
| B6 | `/suivi` à 390 px | La page déborde de 165 px dès que la semaine compte neuf séances. Le balayage de la CI ne le voit pas : il tourne sur un espace vide | Mesure du balayage | Corrigé au lot K2 : la cause était un texte pour lecteur d'écran posé en absolu, sorti du cadre défilant de la grille. Balayage sur données remplies dans la CI (`filled-sweep.spec.ts`) |
| B7 | `/reglages` | Une seule page de 4 586 px à 390 px, dix-sept sections, deux sections voisines « Groupes » et « Invitations » qui se confondent, aucune rubrique pour la connexion | Capture | Lot A |

Les six demandes du fondateur (sections 4.1 à 4.6) restent des portes d'ouverture : les constats B2, B5 et B7 les confirment à l'écran.

### 8.4 Défauts gênants

| N° | Écran | Constat | Correction |
| --- | --- | --- | --- |
| G1 | « Lien envoyé » | L'écran ne rappelle pas l'adresse saisie, n'offre ni renvoi ni aide si rien n'arrive | Corrigé au lot C |
| G2 | `/videos` à 390 px | Cinq filtres empilés occupent tout le premier écran avant la première vidéo. « Feuille de barres », propre à la hauteur, est une action de premier rang pour tous les coachs | Corrigé au lot K1 : sous 1024 px, les filtres sont dans une feuille (bouton « Filtres » avec le nombre de filtres actifs, lien pour les effacer), la première vidéo tient dans le premier écran ; « Feuille de barres » n'apparaît que si les athlètes affichés sautent en hauteur (`barSheetInScope`), parcours `video-filters.spec.ts` |
| G3 | `/exercices` | 16 408 px de haut à 390 px : les 311 fiches sont rendues d'un coup. Deux filtres concurrents (liste « Famille de mouvements » et pastilles de catégories). L'haltérophilie est rangée sous « Musculation ». Aucune vignette de geste. La fiche s'ouvre en dialogue, sans adresse à partager | Corrigé au lot F |
| G4 | `/suivi`, `/athletes` à 121 athlètes | 7 310 px et 13 393 nœuds, 1,7 et 2,3 Mo de HTML, aucune recherche par nom, en-tête de colonnes qui ne reste pas en vue | Corrigé au lot K2 : recherche par nom, en-tête collant, rendu par tranches de 30 |
| G5 | Service worker | Il tente de mettre en cache `/exercise-guides/*.svg`, des fichiers qui n'existent pas : une rafale de 404 à chaque page mise en cache. `OFFLINE_PATHS` cite `mes-sauts` et non `mes-videos` : les vidéos de l'athlète ne se rouvrent pas hors ligne | Corrigé au lot K1 : le worker ne demande plus que des fichiers qui existent, garde `/mes-videos` (pré-cachée pour l'athlète) ; `tests/service-worker.test.ts` vérifie chaque chemin gardé contre `app/` et `public/` |
| G6 | En-tête à 390 px | Le sélecteur d'espace se réduit à un chevron, sans nom (défaut 3 confirmé) | Corrigé au lot K1 : sur téléphone, l'icône de la marque remplace le logotype et le sélecteur garde le nom de l'espace, tronqué, sur une cible de 44 px au moins ; parcours `space-switch.spec.ts` |
| G7 | `/calendrier`, `/progres` | Le bloc « Phases de préparation » se répète (un résumé replié et un bouton du même nom) et pousse la semaine sous le premier écran. Le glisser-déposer reste sans retour (4.2) | Corrigé au lot B |
| G8 | Cibles tactiles | Pastilles de filtre de 36 px de haut (calendrier, exercices, console) ; noms d'athlètes cliquables de 21 px de haut (`/athletes`, `/seances/[id]/suivi`). `DESIGN.md` demande 44 px | Corrigé au lot K2 : pastilles et noms à 44 px, cases natives à 24 px ; la dernière, celle des filtres vidéo, est la case dessinée `.check` depuis les finitions web du 22 novembre (`video-filters.spec.ts`) |
| G9 | `/analyse` | Une colonne de 520 px au milieu d'un écran de 1440 px, des chiffres sans hiérarchie, beaucoup de « Non renseigné » | Corrigé au lot K1 : la phrase clé (séances validées sur attribuées) ouvre l'écran, deux colonnes sur ordinateur, les manques regroupés dans « À compléter » (`analysisGaps`), un tiret lu « Non renseigné » à la place des valeurs absentes ; parcours `training-analysis.spec.ts` |
| G10 | Publication | « Séance publiée. Tes athlètes reçoivent la notification. » s'affiche pour un groupe vide, juste avant « Aucun athlète dans ce groupe » | Corrigé au lot K1 sur le web : la publication renvoie le nombre d'athlètes visés et prévenus, `publicationNotice` en tire le message (invitation à inviter si personne) ; tests du domaine, du service et `coach-screens.spec.ts`. Le constructeur natif garde l'ancien texte jusqu'à la parité mobile |
| G11 | `/seances/nouvelle` | 865 Ko de HTML : toute la bibliothèque et ses guides voyagent dans la page. À 390 px, la bibliothèque est tout en bas d'une page de 3 021 px | Corrigé au lot F |
| G12 | Connexion | La redirection vers `/connexion` perd la page demandée (défaut 7 confirmé) | Corrigé au lot C |
| G13 | États vides | `/phases` et `/progres` n'ont qu'une phrase, sans l'athlète de la rubrique que demande `DESIGN.md` | Corrigé au lot K2 |
| G14 | Avatar et logo | Envoyés dans les réglages, affichés nulle part ailleurs | Corrigé au lot E |
| G15 | Invitation | Les consentements sont enregistrés après la transaction : un membre peut exister sans accord tracé | Lot G, avec test |
| G16 | `/synchronisation` | Aucun lien n'y mène | Corrigé au lot A (rubrique Aide) |
| G17 | Essais locaux | Sans prestataire d'e-mail, le journal imprime le lien du logo (`https://tartan.coach`) au lieu du lien d'action : un lien de connexion ou d'invitation ne se joue plus en local, contrairement à ce que dit `docs/tests/README.md` | Corrigé au lot 0, avec test |

### 8.5 Finitions

- Aucun lien d'évitement « Aller au contenu » en tête de page. Corrigé au lot K2.
- 176 textes encore gelés dans `apps/web/eslint-suppressions.json`, répartis sur 37 fichiers (le brief en annonçait 267). Le lot K2 a dégelé les fichiers qu'il touchait (progrès, détail d'une séance) ; le reste demande un lot à part. Corrigé aux finitions web du 22 novembre : les 113 textes restants (23 fichiers : pages légales, e-mails de connexion et du bilan, fiche athlète, outils du calendrier, console de facturation, unités) sont dans `packages/i18n/src/web`, sans texte visible changé ; la base est vide et son test la tient à zéro.
- `/planificateur`, avant l'accord : un bandeau étroit et centré, différent de tous les autres écrans.
- La bibliothèque de départ contient des routines nommées comme des articles (« 4 exercices pour les genoux »), proposées en tête du constructeur parce que les chiffres passent avant les lettres. Corrigé en partie aux finitions web : un nom qui commence par un chiffre se range après les noms de mouvements (`sortExercises`, avec test). Les deux noms eux-mêmes (« 4 exercices pour les genoux », « 5 essentiels pour la mobilité de hanche ») restent : les renommer est un choix éditorial du fondateur.
- `/seance/[id]/series` et sa jumelle côté coach : 5 200 px de haut à 390 px. Corrigé aux finitions web : dans une séance de plusieurs exercices, chacun se replie sous son nom et ses séries cochées, le premier à remplir ouvert, une erreur rouvrant le sien (`performed-sets.spec.ts`).
- `/admin/mouvements` : 68 000 px de haut à 390 px. Corrigé aux finitions web : chaque famille se replie sous son nom et son état de relecture, et ses gestes ne se construisent qu'à l'ouverture.
- `/seances/[id]/suivi` à 120 athlètes : 21 641 px à 390 px, tous les retours et tout l'appel rendus d'un coup. Corrigé aux finitions web : retours et appel par tranches de 30 avec recherche (le composant du lot K2), un lien vers un athlète au-delà de la première tranche l'ouvre quand même ; page ajoutée au balayage `filled-sweep.spec.ts`.
- Ancien moteur de gestes : retiré aux finitions web du 22 novembre (lecture des gestes du premier moteur, table des gestes à reprendre, séries de relecture « famille » et « famille:face », dessins 2D du premier corps). Les données des gestes du premier moteur restent, parce que 96 gestes en sont relevés au moment de l'affichage et que l'app native les importe encore.
- `apps/web/public/icon-maskable-512.png` n'est plus produit par aucun script. Corrigé par le lot du logo : `scripts/build-logo.mjs` le produit, un test le vérifie.
- Documents périmés : commit de production dans `ETAT.md`, nombre de flux Maestro et job Android dans `docs/tests/README.md`, étapes I1 à I3 de `ios.md`, 74 pages annoncées pour 75.

### 8.6 Mesures de performance

Build de production local, viewport de 390 px, processeur ralenti quatre fois.

| Page | LCP | HTML transféré | Nœuds |
| --- | --- | --- | --- |
| `/` | 1,0 s | 26 Ko (379 Ko de scripts) | 1 202 |
| `/connexion` | 0,3 s | 8 Ko | 344 |
| `/aujourdhui` | 0,7 s | 20 Ko | 326 |
| `/calendrier` (coach) | 0,4 s | 128 Ko | 446 |
| `/seances/nouvelle` | 0,6 s | 865 Ko | 4 351 |
| `/exercices` | 0,5 s | 781 Ko | 3 189 |
| `/planificateur` | 0,4 s | 535 Ko | 762 |
| `/suivi`, 121 athlètes | 0,8 à 1,6 s | 1 711 Ko | 8 168 |
| `/athletes`, 121 athlètes | 0,7 s | 2 345 Ko | 13 393 |

Le temps d'affichage est bon. Le poids des pages qui embarquent la bibliothèque ou un grand groupe ne l'est pas sur un réseau de stade.

### 8.7 Les 14 parcours obligatoires de la recette

Cette liste n'existait nulle part. Elle sert au lot de recette (section 5, lot 9).

1. **Coach neuf** : inscription par lien et par mot de passe, vérification de l'adresse, création de l'espace, onboarding.
2. **Invitation** : lien du groupe, QR code, e-mail nominatif ; l'athlète rejoint par lien et par mot de passe, avec ses consentements.
3. **Séance** : constructeur (circuit, superset, séries détaillées, remplacement en autonomie), publication, duplication, modèle.
4. **Planning** : semaine, mois, liste ; déplacer et dupliquer à la souris, au doigt et au clavier.
5. **Athlète** : écran du jour, validation complète et partielle, absence, mode séance, séries réalisées, hors ligne puis synchronisation.
6. **Suivi** : grille, alertes, relance, export, détail d'une séance, saisie des séries pour un athlète.
7. **Exercices** : bibliothèque, fiche, favoris, listes, personnalisation, création, guide vu par l'athlète.
8. **Vidéo** : envoi par l'athlète et par le coach, encodage, remarque, tracé, plein écran, partage au groupe, quota.
9. **Planificateur** : mettre en forme, proposer, ajuster, exercice inconnu, dictée, brouillons.
10. **Progression** : charges, références de force, records et carte à partager, phases, analyse.
11. **Annonces et notifications** : annonce, centre de notifications, push web, e-mails, préférences, nouveautés.
12. **Réglages** : profil et photo, connexion et mot de passe, espace, groupes, membres, confidentialité, export, suppression du compte.
13. **Abonnement** : essai, paiement en bac à sable, retour vers Tartan, portail, changement d'offre, plafonds.
14. **Console et site** : espaces, utilisateurs, configuration, mouvements ; accueil, tarifs, aide, contact, pages légales, installation de la PWA.

### 8.8 Décisions du fondateur du 17 novembre

- **Exercices** : moteur de gestes refait, chaque fiche de profil et de face, personnage plus fin, plus un emplacement vidéo par fiche commune.
- **Planificateur** : appels OpenAI réels autorisés pour la mesure, 30 € au plus.
- **Production** : la base n'est pas utilisée ; elle est vidée après sauvegarde, sauf le compte administrateur et sa passkey. Les essais en production se font avec les deux adresses du fondateur.
- **Listes d'exercices** : privées par défaut, partage au choix avec les coachs de l'espace (question 1 de la section 6).
- **Ajouts au périmètre** : onboarding complet du coach et de l'athlète, réglages refondus en rubriques, photo de profil avec recadrage et avatars, espace de démonstration.
- **Design** : carte blanche ; `DESIGN.md` évolue avec la refonte.

### 8.9 Lots, dans l'ordre retenu

Cet ordre remplace celui de la section 5. Trois pistes avancent en même temps sur des fichiers disjoints ; les fusions se font une par une.

| Vague | Piste compte | Piste séances | Piste identité et IA |
| --- | --- | --- | --- |
| 0 | Lot 0 : textes propres au web hors du filtre Maestro, port Playwright réglable, lien d'action dans le journal local (G17) ; production vidée | | |
| 1 | A. Réglages en rubriques (B7, G16) | B. Glisser-déposer du planning (4.2) | Planche logo, prototype du personnage, mesure de départ du planificateur |
| 2 | C. Mot de passe (4.1, B2, G1, G12) | D. Vidéo en plein écran (4.4) | Planificateur : erreurs lisibles, sortie alignée sur le constructeur |
| 3 | E. Photo de profil et avatars (G14) | F. Listes, fiche et sélecteur d'exercices (4.3, G3, G11) | Moteur de gestes et lecteurs, après validation du prototype |
| 4 | G. Onboarding du coach et de l'athlète (B1, B3, G15) | Planificateur : contexte enrichi, réponse en direct, écran en deux temps (B4) | Gestes par famille (B5), déploiement du logo |
| 5 | K. Corrections (B6, G2, G4 à G10, G13, finitions) | Espace de démonstration | Nouvelle morphologie partout |
| 6 | L. Recette web sur les 14 parcours | Parité mobile en quatre PR | Retrait de l'ancien moteur, bêtas |

Pourquoi les réglages avant le mot de passe : le lot C écrirait sinon dans les deux gros fichiers que le lot A découpe. Pourquoi un lot 0 : tout nouveau texte va aujourd'hui dans `packages/i18n`, que le filtre mobile surveille ; sans lui, chaque PR web attend Maestro une heure.
