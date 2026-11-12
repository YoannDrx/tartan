# Journal de passation

Chaque agent ajoute une entrée en haut, à la fin de son travail. Cinq lignes suffisent. L'état d'avancement reste dans [ETAT.md](ETAT.md) : ici, seulement ce qu'un autre agent doit savoir pour reprendre.

Modèle :

```text
## AAAA-MM-JJ, agent, sujet
Fait : … (PR)
Vérifié : … / Non vérifié : …
En cours ou abandonné : branche, raison
À savoir : piège découvert, décision prise
Suite conseillée : numéro de tâche
```

## 2026-11-12, Claude, M2 et T09 : Maestro sur simulateur en CI

Fait : job `maestro` dans `.github/workflows/mobile-native.yml`, sur macOS : Postgres installé par Homebrew, migrations, graine de démonstration, compte sans date de naissance pour `age-gate`, serveur web local (`next start`), app de développement compilée pour le simulateur iOS (`TartanDev`, en Release, l'API sur `http://localhost:3000`), puis `maestro test .maestro`. Les flux de l'athlète n'ont plus de `runFlow: when` ; `coach-tracking` ouvre la séance du jour et enregistre l'appel (PR `test/maestro-ci`).
À savoir : aucun secret, tout naît et meurt dans le job. En local, CocoaPods exige `LANG=en_US.UTF-8`. Les artefacts du job (rapport JUnit, captures de Maestro, journal du serveur) aident à comprendre un échec.
Vérifié en local : l'app de développement se compile pour le simulateur (Xcode 26.2), s'ouvre sur l'écran de connexion et joint le serveur local ; la graine et le compte sans date de naissance se créent comme dans le job.
Non conclu : un lien de retour fabriqué à la main (`tartan-dev://callback?cookie=…`, cookie obtenu par `sign-in/email`) est refusé par l'écran de retour, avec l'ancienne version comme avec celle de M4. Ce lien n'est pas celui du serveur ; le vrai lien magique reste à essayer, et c'est un bon candidat pour le flux Maestro de M4.
Suite conseillée : les flux de T24, puis ceux de M4 (changement de compte) et M5 (vidéo juste encodée).
## 2026-11-12, Claude, M6 : révocation Apple pour la connexion native

Fait : l'app iOS envoie le code d'autorisation d'Apple à `POST /api/v1/me/apple-authorization`. Le serveur l'échange auprès d'Apple avec le bundle de l'app (`APPLE_APP_BUNDLE_IDENTIFIER`), vérifie que le sujet du jeton est le compte Apple relié, puis garde le jeton de rafraîchissement et l'identifiant qui l'a délivré (colonne additive `account.apple_client_id`). La suppression du compte révoque avec cet identifiant (PR `feat/apple-revocation`).
Vérifié : `tests/auth-social.test.ts` (échange, révocation avec le bundle, autre compte Apple refusé, compte sans Apple, configuration absente, panne d'Apple), ligne de la matrice d'accès.
Non vérifié : un échange réel avec Apple. La connexion Apple reste éteinte ; le jour où elle s'allume, poser `APPLE_APP_BUNDLE_IDENTIFIER` sur Vercel.

## 2026-11-12, Claude, fin de la file du 12 novembre : bilan

Fait et fusionné : B5 à B9, C1 à C3, J2 à J10, retouche du film et des tapis, puis les tests T10 à T22 et T25, M1, M4, M5, P1 (une PR par lot, empilées pour éviter les conflits de `ETAT.md` et `JOURNAL.md`). T23 et T24 sont documentés comme hors CI, dans `docs/tests/automatisation.md` (PR `docs/tests-hors-ci`).
À savoir : les PR de tests touchent toutes la ligne T-suite d'`ETAT.md` et le haut du journal. Les empiler (chaque branche part de la précédente) évite de relancer une CI par conflit. Le job `quality` a désormais 60 minutes : les parcours en prennent près de 30.
Reste au fondateur : ouvrir le classement du jeu dans `/admin/configuration` s'il le souhaite ; lancer un build EAS de production (M1) ; la clé OpenAI (F6), puis une vraie dictée et `eval:planner --live` (T23) ; vérifier `AI_TRANSCRIPTION_MODEL` sur Vercel ; installer Maestro pour T24 ; les autres lignes du tableau « Fondateur ».
Suite conseillée : M2 et T09 (Maestro en CI), M3 (captures), M6 si la connexion Apple doit ouvrir.

## 2026-11-12, Claude, M4 : changement de compte par lien magique sur mobile

Fait : l'écran de retour (`app/(auth)/callback.tsx`) vidait le cache avant de poser le nouveau cookie. Un écran encore monté de l'ancien compte pouvait donc relire `/me` avec l'ancien cookie, et l'aiguillage retrouvait l'ancien rôle, ce que le simulateur avait montré le 9 novembre. Le cookie était aussi fusionné avec l'ancien, et l'espace actif mémorisé restait celui de l'ancien compte. `src/lib/account-switch.ts` fixe l'ordre : arrêter les requêtes, effacer puis poser le cookie, vider les données et l'espace mémorisé, relire la session, repartir de l'aiguillage (PR `fix/mobile-changement-compte`, empilée sur M5).
Vérifié : deux tests de l'ordre, typecheck du mobile.
Non vérifié : sur simulateur, et pas de flux Maestro dédié (Maestro n'est pas installé sur ce poste). La cause reste donc « probable » tant que l'essai réel n'est pas fait.

## 2026-11-12, Claude, M5 : repli HLS du lecteur mobile

Fait : `apps/mobile/src/lib/playback-source.ts` choisit la source (MP4 d'abord, HLS s'il manque), et `app/video/[id].tsx` repart une fois sur le HLS quand le lecteur échoue sur le MP4, comme le web (PR `feat/mobile-hls-repli`, empilée sur P1).
Vérifié : trois tests de la règle, typecheck du mobile.
Non vérifié : sur un téléphone, une vidéo ouverte juste après l'encodage. Il faut un build de développement et une vidéo Mux réelle.

## 2026-11-12, Claude, P1 : la dictée passe à gpt-transcribe

Fait : `AI_TRANSCRIPTION_MODEL` vaut `gpt-transcribe` par défaut. La requête envoie `languages[]`, `keywords[]` et un `prompt` de contexte court, jamais `language` (PR `feat/gpt-transcribe`). Source : la documentation d'OpenAI, pages « Transcription » et « GPT-Transcribe » (recherche externe du 12 novembre 2026). L'ancien modèle reste accepté jusqu'à son arrêt.
Vérifié : tests du fournisseur de transcription, de l'API et du flux de dictée.
Non vérifié : une vraie dictée. Elle attend la nouvelle clé OpenAI (F6). Le fondateur doit aussi vérifier si `AI_TRANSCRIPTION_MODEL` est défini sur Vercel avec l'ancien nom.

## 2026-11-12, Claude, M1 : l'échec des builds EAS à « Read app config »

Fait : cause trouvée dans le journal du build Android du 9 novembre sur expo.dev : `expo config` échoue sur `app.config.ts` (« Unexpected token '{' »). La configuration importe deux fichiers TypeScript que seule la lecture native de Node savait charger. Correction : `import "tsx/cjs"` en tête de la configuration, et `tsx` en dépendance de développement du mobile (PR `fix/eas-app-config`).
Vérifié : `src/lib/app-config.test.ts` lit la configuration de production avec et sans le TypeScript natif de Node ; il échoue sans la correction.
Non vérifié : un build EAS réel. Il engage le compte du fondateur, qui le lance (commande dans `docs/plans/android.md`).
À savoir : les variables EAS de production ne sont pas en cause (`GOOGLE_SERVICES_JSON` sous forme de texte a été testé localement avec une valeur factice).

## 2026-11-12, Claude, test T20 : fiches de la console

Fait : `apps/web/e2e/admin-console.spec.ts` ouvre aussi `admin/espaces/[id]` et `admin/factures/[id]` (PR `test/console`).
Vérifié : quatre parcours verts en build de production, ordinateur et téléphone.
À savoir : les deux projets créent chacun un espace « Coaching Console » dans la même base. Cibler une ligne par son identifiant, pas par son nom.

## 2026-11-12, Claude, test T19 : les pages sans parcours, avec données

Fait : `apps/web/e2e/filled-pages.spec.ts` (PR `test/pages-donnees`) remplit un compte neuf avec `prisma/demo-fill.ts`, puis visite `/mes-sauts`, une vidéo, `/progres` et `/seances/[id]/charges`.
Vérifié : parcours vert en build de production, projet mobile.
À savoir : le script de démonstration refuse un second remplissage dans la même base. Le parcours ne tourne donc que sur le projet mobile, sans nouvelle tentative. Dans un fichier de parcours, `__dirname` n'existe pas : utiliser `import.meta.dirname`.

## 2026-11-12, Claude, test T18 : centre de notifications, et cloche corrigée

Fait : `apps/web/e2e/notification-center.spec.ts` (PR `test/notifications`). Correction : après « Tout marquer comme lu », la cloche gardait son ancien compteur, car elle ne relisait qu'au changement d'adresse. La liste émet désormais `NOTIFICATIONS_READ_EVENT` après chaque lecture, et la cloche relit.
Vérifié : quatre parcours verts en build de production, ordinateur et téléphone.
Non vérifié : sur un vrai téléphone.

## 2026-11-12, Claude, test T14 : la page abonnement

Fait : `apps/web/e2e/subscription.spec.ts` (PR `test/abonnement`).
Vérifié : quatre parcours verts en build de production, ordinateur et téléphone.
À savoir : le serveur e2e n'a pas de clé Stripe, la vente y est donc coupée, comme en production avant l'ouverture. Le parcours vérifie qu'aucun bouton n'y lance un paiement ; le paiement lui-même reste couvert par T03 en sandbox.

## 2026-11-12, Claude, tests T12 et T13 : invitation nominative et changement d'espace

Fait : `apps/web/e2e/staff-invitation.spec.ts` et `apps/web/e2e/space-switch.spec.ts` (PR `test/espaces`).
Vérifié : quatre parcours verts en build de production, ordinateur et téléphone.
À savoir : un espace neuf est en Découverte, plafonnée à un coach : sans `setOffre(…, "pilot")`, l'invitation d'un coach est refusée par l'offre, en silence pour un test qui attend un toast de succès. Pour un cookie forgé, prendre un espace dont le compte n'est vraiment pas membre.

## 2026-11-12, Claude, test T21 : le worker du site

Fait : `apps/web/tests/service-worker.test.ts` exécute le vrai `public/sw.js` avec `node:vm`, dans un faux contexte de worker (notifications, fenêtres, caches, réseau) (PR `test/worker`).
Vérifié : cinq tests verts : notification, clic, réponse depuis la notification, filtres de `fetch`, repli hors ligne.
À savoir : le worker reste du JavaScript sans module : on le charge tel quel, rien n'est extrait pour le test.

## 2026-11-12, Claude, tests T15, T16 et T17 : gardes d'accès

Fait : `apps/web/tests/access-guards.test.ts` : lien de parrainage `r/[code]`, limiteur de connexion de Better Auth, vérification renforcée de la console (PR `test/garde-acces`). La règle d'activation du limiteur devient la fonction `rateLimitEnabled` de `src/lib/auth.ts`, sans changement de comportement.
Vérifié : dix tests verts. Le test de la console lit les fichiers : une action de `src/features/admin/*.action.ts` qui ne serait pas une `adminAction`, ou une route de `/admin` sans `requireStepUp`, le fait échouer.
Suite conseillée : T12, T13, T14 (parcours e2e), T18 à T21.

## 2026-11-12, Claude, tests T11, T22 et T25 : routes techniques

Fait : `apps/web/tests/technical-routes.test.ts` appelle les vrais handlers de la tâche horaire, de `health`, `live`, `version`, du flux `ical`, ainsi que `manifest`, `robots` et `sitemap` (PR `test/routes-techniques`).
Vérifié : neuf tests verts. Seuls le secret de la tâche, une tâche en panne (`processReferrals`) et une base coupée (`$queryRaw`) sont simulés.
À savoir : le mock de `@/lib/env` étend le vrai environnement, sinon la base de test n'est plus joignable ; ses constantes passent par `vi.hoisted`.
Suite conseillée : T12 à T21.

## 2026-11-12, Claude, tests T10 : la vidéo en HTTP

Fait : `tests/video-http.test.ts` passe par les vrais handlers des routes vidéo, avec une vraie session, Mux seul simulé : création d'une adresse d'envoi, renouvellement d'une adresse expirée, liste du coach, vidéo invisible de l'athlète avant partage, remarque, partage et notification, partage au groupe refusé, remarque retirée ; un coach d'un autre espace ne crée, ne lit ni ne partage rien. `tests/upload-queue.test.ts` fait tourner la vraie file d'envoi du navigateur contre un faux serveur qui suit le protocole reprenable de Mux : envoi en morceaux de 4 Mio, reprise après coupure sans renvoyer ce qui est reçu, adresse expirée renouvelée, refus définitif abandonné, envoi hors ligne gardé (PR `test/video-http`).
À savoir : la fin du traitement par Mux (webhook) est posée en base dans ce test ; elle a son propre test signé, `mux-webhook.test.ts`.
Suite conseillée : T11 et T22.
## 2026-11-12, Claude, lot J3 : classement du jeu, construit et fermé

Fait : trois tables additives (`game_runs`, `game_scores`, `game_bans`). `src/server/game.service.ts`, service public limité à ces tables : le départ d'un essai tire la graine côté serveur et rend un jeton à usage unique (15 min) ; l'envoi consomme le jeton, rejoue le journal des appuis avec `packages/game`, refuse un score impossible (plafond), une partie arrivée plus vite que son horloge (90 % de sa durée), un pseudo filtré (3 à 16 caractères, mots refusés), un appareil banni, et limite le débit par empreinte d'adresse ; une marque nulle n'est pas classée. Classement par épreuve, semaine en cours ou depuis toujours, meilleur score par appareil. Effacement sans compte par l'appareil. Tâche quotidienne : empreintes IP effacées à 30 jours, jetons inutilisés à un jour. Routes `/api/v1/game/runs`, `/scores` (POST et DELETE), `/leaderboard`. Console `/admin/jeu` (masquer, bannir). Réglage « Classement du jeu » dans `/admin/configuration`, fermé par défaut ; sur `/jeu`, rien ne change tant qu'il est fermé (PR `feat/jeu-classement`).
Vérifié : `tests/game-leaderboard.test.ts` (fermé, score classé, jeton rejoué, journal falsifié, partie trop rapide, pseudo refusé, débit, effacement, bannissement, purge), quatre lignes de la matrice d'accès, `e2e/game-page.spec.ts` (classement ouvert : une course réelle classée sous un pseudo, puis effacée), `/admin/jeu` dans le parcours de la console.
À savoir : sur un POST, next-zod-route lit déjà le corps ; les routes le valident donc elles-mêmes (`route.body`). Le rejeu prouve qu'un score découle d'appuis valides, pas qu'un humain a joué. Le fondateur a rapporté le 12 novembre l'accord du juriste ; la politique de confidentialité porte maintenant la mention « Le jeu du site » (données, base, durées, effacement sans compte). Basculer le réglage dans `/admin/configuration` reste son geste.
Suite conseillée : tests T10 à T25.

## 2026-11-12, Claude, lot J4 : aperçu du jeu sur la page d'accueil

Fait : `src/features/landing/warm-up.tsx`, entre la ligne d'arrivée et les questions fréquentes : Inès sur sa ligne de départ, « Jouer au 110 m haies ici », un lien vers `/jeu`. Le clic charge le moteur de partie et le 110 m haies (`import()`), puis la course se joue dans la page (PR `feat/jeu-encart`).
Vérifié : `e2e/landing.spec.ts` lit le contenu de chaque script chargé par la page : aucun ne contient le code de la simulation avant le clic (repère : le message « invalid seed » du noyau), un au moins après ; la course démarre sur la page.
À savoir : pas d'événement d'audience sur mesure (la mesure actuelle ne compte que les pages vues) : l'effet de l'aperçu se lira sur les visites de `/jeu` et de la création d'espace.
Suite conseillée : J3, construit mais éteint.

## 2026-11-12, Claude, lot J10 : combiné

Fait : `packages/game/src/combined.ts` convertit chaque marque en points, par épreuve, sur une droite entière : 0 point à la marque basse (18,00 s aux haies, 3 m en longueur, 9 m au triple, 1,50 m en hauteur, 4 m à la perche, 15 m au disque), 1 000 à la marque haute (13,00 s, 7,50 m, 15 m, 2 m, 5,70 m, 45 m), 1 200 au plus, 0 pour un essai nul. Sur `/jeu`, « Jouer le combiné » charge les six épreuves et les enchaîne, un essai chacune ; le moteur de partie accepte un rappel en fin d'épreuve et remplace « Rejouer » par « Épreuve suivante » (PR `feat/jeu-combine`).
Vérifié : `combined.test.ts` (bornes, sens des épreuves, plafond, total), `e2e/game-page.spec.ts` (une épreuve, ses points, l'épreuve suivante).
À savoir : le barème est celui du jeu, sans rapport avec les tables officielles. Le classement du combiné, comme celui des épreuves, attend J3 (éteint tant que le juriste n'a pas répondu sur le classement public).
Suite conseillée : J4.

## 2026-11-12, Claude, lot J9 : lancer du disque

Fait : `packages/game/src/events/discus.ts`. Tenir l'appui lance la volte : la rotation gagne 1/16° par pas à chaque pas, jusqu'à 6° par pas (720° par seconde). Relâcher lâche le disque dans la direction du bras : dans le secteur (±17°), sa vitesse (230 mm/s par seizième de degré et par pas) donne la distance, angle d'envol fixe à 35° ; hors du secteur, mordu ; au-delà de trois tours, sorti du cercle. Forme du jour ±40 cm ; plafond 47,099 m. Sur `/jeu`, Mehdi rejoue le geste de `packages/mascot` ; un cadran vu de dessus montre le secteur en citron et le bras qui tourne (PR `feat/jeu-disque`).
Vérifié : `discus.test.ts` (rotation, secteur, sortie du cercle, plafond), références et 300 journaux sous Node, Chromium et WebKit, `e2e/game-page.spec.ts` ; volte et mordu regardés à 390 px. Non vérifié : un lancer valable regardé à l'image.
À savoir : les six épreuves sont jouables ; restent le classement (J3), l'aperçu sur la page d'accueil (J4) et le combiné (J10).
Suite conseillée : J10.

## 2026-11-12, Claude, lot J8 : saut à la perche

Fait : la règle des concours à barre passe dans `packages/game/src/events/bar-event.ts` (`defineBarEvent`), que la hauteur et la perche paramètrent ; les références de la hauteur restent identiques au chiffre près. `pole-vault.ts` : barre de 4,20 m, +15 cm ; planté à ±3, ±8, ±18 pas (5,80, 5,40, 4,95 m atteignables), renversement à ±4, ±9, ±15 pas (0, 8, 18 cm perdus) ; forme du jour ±5 cm ; plafond 5,85 m. Les temps d'un essai (270 pas) font tenir un concours, même avec deux échecs à chaque hauteur, dans les 90 s d'une partie. Sur `/jeu`, Malo rejoue le geste de `packages/mascot`, perche qui plie comprise ; la description des deux concours est commune (`bar-ui.ts`) ; le robot de test aussi (`bar.bots.ts`) (PR `feat/jeu-perche`).
Vérifié : `pole-vault.test.ts` (montée de la barre, coût du renversement, durée d'un concours, plafond), tests de la hauteur inchangés, références et 300 journaux sous Node, Chromium et WebKit, `e2e/game-page.spec.ts` ; flexion et réception regardées à 390 px.
Suite conseillée : J9.

## 2026-11-12, Claude, lot J7 : saut en hauteur

Fait : `packages/game/src/events/high-jump.ts`. Chaque essai : course automatique de 150 pas ; un appui à ±3 pas de l'instant juste donne 2,05 m atteignables, ±8 pas 1,96 m, ±18 pas 1,82 m (au-delà, refus) ; tenir pendant le vol, puis relâcher à ±3, ±8 ou ±14 pas du bon moment coûte 0, 3 ou 7 cm (relâcher trop tôt ou trop tard fait tomber la barre) ; forme du jour tirée de la graine, ±2 cm. Concours : barre de 1,60 m, +5 cm après chaque hauteur franchie, trois échecs de suite arrêtent tout ; marque, la plus haute barre franchie ; plafond 2,05 m. Sur `/jeu`, Noé rejoue le geste de `packages/mascot` cadré dans le canvas, la barre tombe sur le tapis en cas d'échec, un repère citron marque le point d'appel (PR `feat/jeu-hauteur`).
Vérifié : `high-jump.test.ts` (montée de la barre, trois échecs, refus, coût des écarts, barre tombée, plafond), références et 300 journaux sous Node, Chromium et WebKit, `e2e/game-page.spec.ts` ; élan, appel et vol regardés à 390 px.
À savoir : le repère d'appel a été ajouté après coup, faute de quoi l'instant de l'appel ne se devine pas. J5 vérifié en production le même jour (un saut joué sur tartan.coach/jeu).
Suite conseillée : J8.

## 2026-11-12, Claude, lot J6 : triple saut

Fait : `packages/game/src/events/triple-jump.ts`, sur l'élan et l'appel de la longueur. Le cloche-pied part à 24° au plus, la foulée à 12°, le saut à 18°. À chacune des deux réceptions, un appui à ±3 pas du contact garde 95 % de l'élan, à ±7 pas 92 %, à ±12 pas 88 % ; au-delà, ou sans appui, le rythme est cassé (score nul). Le sable commence à 9 m de la planche ; plafond théorique 15,596 m. Sur `/jeu`, Awa suit les trois temps du geste de `packages/mascot`, et un repère citron marque sur la piste où le pied va toucher (PR `feat/jeu-triple-saut`).
Vérifié : `triple-jump.test.ts` (rythme, coût de chaque pas d'écart, rythme cassé, mordu, essai nul, plafond), références et 300 journaux sous Node, Chromium et WebKit, `e2e/game-page.spec.ts` (une partie au clavier) ; cloche-pied et rythme cassé regardés à 390 px.
À savoir : deux réceptions parfaites à huit appuis par seconde donnent environ 12,5 m ; à douze appuis par seconde et vent favorable, environ 13,4 m. Le repère du contact a été ajouté après coup : sans lui, on ne peut pas anticiper la réception.
Suite conseillée : J7.

## 2026-11-12, Claude, lot J5 : saut en longueur

Fait : `packages/game/src/events/long-jump.ts`. Chaque appui bref ajoute 800 mm/s d'élan, le frottement en reprend 0,34 % par pas ; un appui tenu plus de 10 pas devient l'appel, l'angle monte d'un degré tous les deux pas (frottement quatre fois moindre pendant l'appel) ; relâcher lance le saut. Vol en entiers, sinus et cosinus figés en table ; marque mesurée depuis la planche ; mordu au-delà de la planche, essai nul avant le sable (un mètre après la planche) ; plafond théorique 9,378 m. Le jeu devient générique : `game-runner.tsx` fait tourner toute épreuve décrite par un `EventUi` (`hurdles-ui.ts`, `long-jump-ui.ts`) ; `/jeu` propose le choix de l'épreuve, chargée au premier geste. Les références de toutes les épreuves passent par `REFERENCES`, rejouées par les tests du paquet et la preuve inter-navigateurs (PR `feat/jeu-longueur`).
Vérifié : `long-jump.test.ts` (élan, appel, mordu, essai nul, marque depuis la planche, plafond), parties de référence et résumé de 300 journaux sous Node, Chromium et WebKit (`e2e/game-determinism.spec.ts`), `e2e/game-page.spec.ts` (une partie de longueur au clavier) ; élan, vol, mordu et réception regardés à 390 px.
À savoir : réglages choisis pour des cadences humaines : 8 appuis par seconde et la planche au plus près donnent environ 7,4 m, 6 par seconde environ 6,4 m, 5 par seconde environ 5,7 m. Un essai nul vaut 0 et n'est jamais un record. L'épreuve n'étant pas encore publiée, SIM_VERSION ne change pas.
Suite conseillée : J6.

## 2026-11-12, Claude, lot J2 : la page du jeu

Fait : `/jeu` (`app/(public)/jeu/page.tsx`) montre une affiche ; « Jouer au 110 m haies » charge alors le jeu (`hurdles-game.tsx`), qui fait avancer la simulation de `packages/game` par pas fixes de 1/120 s et dessine chaque image en canvas (`hurdles-scene.ts`). Inès court avec la foulée de `packages/mascot` (nouveau `hurdlerPose`, le pied le plus bas posé sur la piste) et saute à la hauteur que calcule la simulation. Record local, pause sur Échap et quand la page est cachée, résultats en HTML annoncés aux lecteurs d'écran. `/jeu` entre dans `SITE_PATHS`, le plan du site et les robots ; image de partage `public/brand/og-jeu.png`. La sérialisation SVG d'un athlète passe dans `src/lib/figure-svg.ts`, partagée avec la carte de record (PR `feat/jeu-page`).
Vérifié : `e2e/game-page.spec.ts` (affiche sans jeu chargé, pause, sauts au clavier, course jusqu'à l'arrivée, record gardé au rechargement, plan du site et robots), `packages/mascot/src/hurdler.test.ts` ; course et saut regardés à 390 px.
À savoir : un canvas ne lit pas les variables CSS : la police est lue sur la page et passée au dessin. Le contrôle du mouvement réduit (`motionOn`) ne compte plus une animation ramenée à 0,01 ms par le filet : sur une machine chargée, elle pouvait être saisie « en cours » et faire échouer le parcours du site (aléa vu à B9 et ici). Le journal des appuis n'est pas encore gardé : il le sera avec le classement (J3). Correctif de C3 en passant : la carte de record lisait ses polices par un chemin construit à la volée, ce qui faisait embarquer tout le projet dans la fonction ; les chemins sont maintenant écrits en entier et déclarés dans `outputFileTracingIncludes` (vérifié sur le fichier de traçage du build).
Suite conseillée : J5.

## 2026-11-12, Claude, lot C3 : carte de record

Fait : `GET /api/v1/orgs/[orgId]/athletes/[athleteId]/performances/[performanceId]/carte` rend une image PNG 1080 × 1350 (`next/og`, polices Barlow embarquées dans `apps/web/assets/fonts`) ; `performanceCard` (`performance.service.ts`) n'en donne que le prénom, la discipline, la marque et la date, et seulement pour un record battu. Sur la page Progrès, « Partager » remet l'image au menu de partage du téléphone, ou l'enregistre sur un ordinateur (PR `feat/carte-record`).
Vérifié : `tests/record-card.test.ts` (référence initiale sans carte, ni lieu ni vent, accès refusé à un coéquipier et à un autre espace, PNG au bon format), `tests/discipline-athlete.test.ts`, ligne de la matrice d'accès, `e2e/record-card.spec.ts` (menu de partage remplacé par un témoin qui reçoit le fichier) ; cartes et page Progrès regardées. Non vérifié : partage sur un vrai téléphone ; rendu sur Vercel (lecture des polices par `process.cwd()`, à confirmer après déploiement).
À savoir : Satori lit le SVG comme une image : l'athlète est sérialisé à la main (`figureSvg`), sans React. La première marque d'une discipline est la référence initiale, pas un record battu : elle n'a pas de carte.
Suite conseillée : J2.

## 2026-11-12, Claude, lot C2 : série de régularité

Fait : `regularity()` dans `packages/domain` compte les semaines de suite où l'athlète a rendu chacune de ses séances ; `regularityOf` et `athleteRegularity` (`stats.service.ts`) la lisent sur un an. L'accueil de l'athlète montre un tour de piste : la part courue est la semaine en cours, le chiffre au centre la série. La fiche de l'athlète côté coach porte « Série de régularité ». Les textes gelés de ces deux pages sont passés dans `packages/i18n` (PR `feat/regularite`).
Vérifié : `packages/domain/src/regularity.test.ts` (six cas), `tests/regularity.test.ts` (série lue en base, accès refusé à un autre espace), `e2e/regularity.spec.ts` (une séance rendue lance la série, le coach la lit) ; accueil et fiche regardés à 390 px. Non vérifié : aucun vrai téléphone.
À savoir : règle décidée par moi, à confirmer par le fondateur. Une séance partielle compte comme rendue, c'est un retour au coach. Une absence signalée excuse la séance, pour que dire « je ne viens pas » ne coûte jamais rien (lien avec C1). Une séance encore dans son délai de saisie (24 h après sa journée) ne casse rien. La série est en bas de l'accueil, après les séances : placée au-dessus, elle repoussait la séance du jour sous le pli, et le bandeau sortait de l'écran au clic, ce qui coupait sa transition (`e2e/session-open.spec.ts`). La clé `m.athletes.regularity` existait déjà pour une autre mesure (les quatre dernières semaines, page Progrès) : la série s'appelle `streak` dans les textes.
Suite conseillée : C3.

## 2026-11-12, Claude, lot C1 : absence signalée par l'athlète

Fait : l'athlète qui répond « je ne viens pas » prévient ses coachs (notification `absence_reported`, « Léa ne viendra pas jeudi »), une fois et pour une séance à venir ; il peut ensuite dire pourquoi, d'un geste de plus, parmi travail, études, transport, famille, autre raison. Le motif est enregistré dans `attendance.absence_reason` (migration additive), lu par le coach dans le suivi de la séance, effacé par « je viens » (PR `feat/absence-athlete`).
Vérifié : `tests/absence.test.ts` (liste fermée sans santé, une seule notification sans motif, motif effacé, séance passée muette), `packages/domain` (texte de la notification), `e2e/absence.spec.ts` (l'athlète sur téléphone, le coach lit la notification et le motif). Non vérifié : notification sur un vrai téléphone.
À savoir : la réponse existait déjà (elle bascule l'athlète en autonomie) ; le coach n'en était simplement pas prévenu. Le motif choisi n'est pas réaffiché à l'athlète quand il revient sur l'écran : seul le coach le relit. L'application mobile envoie `status` sans motif, ce que le contrat accepte toujours.
Suite conseillée : C2.

## 2026-11-12, Claude, lot B9 : finitions de l'application

Fait : la table commune de la console (`DataTable`, `console-ui.tsx`) devient une carte par ligne sur téléphone, première cellule en titre, les autres en paires libellé et valeur ; le tableau des espaces de `/admin` passe par elle ; son dernier texte en dur est déplacé. Connexion et création de l'espace : le groupe sur une ligne de piste (`start-scene.tsx`, option `scene` de `PublicPage`). Cinq e-mails portent un athlète dans leur bandeau, en PNG tirés par `pnpm --filter @tartan/web email:athletes` (PR `feat/da-finitions`).
Vérifié : `e2e/admin-console.spec.ts` (cartes sur téléphone, table dès la tablette), `e2e/age-confirmation.spec.ts` (la pose suit les trois temps), `tests/email-athletes.test.ts` (chaque image existe à la bonne taille, aucune dans un e-mail de sécurité) ; connexion, création de l'espace et deux e-mails regardés à 390, 768 et 1440 px. Non vérifié : aucun e-mail reçu dans une vraie messagerie avec son illustration ; aucun vrai téléphone.
À savoir : les composants web sont compilés en JSX « preserve » pour Next ; un script `tsx` qui les rend doit passer par `tsconfig.scripts.json`. Les images des e-mails ne sont servies par `tartan.coach` qu'après le déploiement. « Écrans immersifs passés aux jetons » était déjà fait : le lint refuse couleurs et durées en dur depuis A3 et B1, une recherche n'en trouve aucune.
Suite conseillée : C1.

## 2026-11-12, Claude, retouche du film et des sautoirs

Fait, à la demande du fondateur : dans le film de la page d'accueil, Inès court jusqu'au bout de sa course, au bord de la scène, et Malo va jusqu'à sa retombée sur le tapis et s'y relève avant le relais (`jump-film-pose.ts` : `HURDLES_END` à l'arrêt de la course, `POLE_VAULT_RANGE` jusqu'au relevé ; la perche passe de 0,28–0,48 à 0,27–0,52 du film, pris sur la hauteur, pour rester fluide). Les sautoirs de hauteur et de perche prennent les couleurs des tapis de stade, à la manière des sautoirs DIMA : corps bleu (`film.matBlue`), dessus rouge (`film.matRed`), liseré blanc au bord du dessus ; dans le film, les gestes de `packages/mascot`, la planche et le jeu (PR `fix/landing-tapis`).
Vérifié : `tests/jump-film-relay.test.ts` (Inès au bord de la scène, Malo sur le tapis, continuité des images), `tests/athlete-colors.test.ts` (liseré présent sur les deux sautoirs, dessus distinct du corps), 200 poses de référence du saut inchangées.
À savoir : aucun rouge n'atteint l'écart minimal avec la piste (0,087 au mieux pour 0,12) : un dessus rouge sur fond rouge ne se lirait pas, d'où le liseré blanc, que le test exige à la place de l'écart. Le test qui imposait de passer le relais avant le retournement du perchiste est remplacé : le corps vu par la tranche passe vite au défilement.

## 2026-11-12, Claude, lot B8 : écrans du coach

Fait : dans le constructeur de séance, « Publier » reste collé au-dessus de la barre de navigation sur téléphone, les autres actions au bout du formulaire (`session-builder.tsx`) ; dans tous les bandeaux, les actions tiennent sur une ligne qui défile de côté sur téléphone (`PageHeader`) ; le « +N » de la grille du mois passe de 10 à 12 px ; `tests/text-size.test.ts` refuse tout texte sous 12 px (PR `feat/da-coach`).
Vérifié : `e2e/coach-screens.spec.ts` sur téléphone et ordinateur : le bouton est à l'écran et rien ne le recouvre au début, au milieu et à la fin du formulaire, puis il publie ; les douze écrans du coach passés à 390 px par une sonde (aucun débordement, aucun texte sous 12 px) et regardés sur leur premier écran. Non vérifié : rien en production ; aucun vrai téléphone ; les écrans n'ont été regardés qu'en thème Tartan et sur un espace presque vide.
À savoir : une barre collante ne colle que dans son bloc parent : sur téléphone, le conteneur des actions est en `display: contents`, pour que le bouton colle dans la grille du formulaire entier ; sur ordinateur il redevient la barre d'actions unique. Ce lot n'est pas une refonte écran par écran : le plan nommait dix écrans, je n'y ai corrigé que ce que le regard et la sonde ont relevé. Le doublon « Phases de préparation » de la vue semaine du calendrier (le titre dépliable et son bouton) reste.
Aléa réparé en passant : sous WebKit, un parcours sur cent soixante-dix échouait à l'onboarding, le nom de l'espace resté vide. Cause : le titre du temps suivant recevait le focus une image après l'affichage (`requestAnimationFrame`), et arrachait la saisie à un champ déjà en cours de remplissage. Le temps s'affiche et prend maintenant le focus d'un seul geste (`flushSync` dans `onboarding-form.tsx`) ; `e2e/age-confirmation.spec.ts` le vérifie, et échoue sur l'ancien code. Un humain ne pouvait pas tomber dessus (une image, 16 ms), un robot si.
Suite conseillée : B9.

## 2026-11-12, Claude, lot B7 : écrans de l'athlète

Fait : `/aujourdhui` et `/seance/[id]` entrent dans le monde de travail (`src/lib/world.ts`) : bandeau piste, barre de navigation sur la piste, thème suivi ; l'écran de séance tient en un bandeau (retour, titre, date) et une feuille (état, type, validation, démarrage) ; la carte du jour s'ouvre en feuille de séance (`sessionCardName`, `seance/[id]/loading.tsx`) ; en thème clair, la carte héros passe au blanc des surfaces (PR `feat/da-athlete`).
Vérifié : `e2e/session-open.spec.ts` sur téléphone et ordinateur : bandeau sur l'accueil, groupe de transition au nom de la séance lu dans le navigateur, 200 ms, feuille et validation sur l'écran de séance, retour, carte distincte du fond en thème clair, axe ; quatre essais sur quatre sur le build de production ; accueil et écran de séance regardés à 390 px dans les trois thèmes, transition regardée au ralenti. Non vérifié : rien en production ; aucun vrai téléphone ; mode séance, progrès, calendrier et vidéos seulement regardés, pas modifiés.
À savoir : un élément partagé ne se retrouve que s'il existe dans la page d'arrivée au moment de la navigation, donc dans son écran d'attente : celui de la séance est un composant client qui lit l'identifiant par `useParams` et nomme sa feuille comme la carte. En développement, cet écran d'attente se compile à la première visite et le lien ne se fait pas : le parcours visite la séance une fois avant de mesurer ; en production il est préchargé avec le lien. Mettre l'accueil dans le monde de travail a révélé que la carte héros, craie, se confondait avec la page craie du thème clair. `BandSkeleton` est sorti de `SheetSkeleton` pour servir aux écrans d'attente propres à une route. `recordTransitions` et `firstTransition` sont dans `e2e/helpers.ts`.
Suite conseillée : B8.

## 2026-11-12, Claude, lot B6 : ossature de l'application

Fait : en-tête du téléphone sans le nom d'espace quand il n'y en a qu'un (il est dans le menu Réglages) ; libellés de la barre basse et pastille de notifications passés de 11 à 12 px ; `TrackTile` et `EmptyState` avec l'athlète de la rubrique (`src/lib/rubric-athlete.ts`) dans les seize états vides et sur la page d'erreur ; feuilles, dialogues, menu et messages animés à l'entrée et à la sortie (PR `feat/da-ossature`).
Vérifié : `tests/rubric-athlete.test.ts` (table de `DESIGN.md`, chaque état vide a sa rubrique, plus d'ancienne mascotte) ; `e2e/shell.spec.ts` sur téléphone et ordinateur (nom d'espace, animation du menu et de la feuille lue dans le navigateur, cibles de 44 px, aucun libellé sous 12 px, athlète de la rubrique, axe). Non vérifié : rien en production ; aucun vrai téléphone ; thèmes clair et sombre non regardés pour les états vides.
À savoir : `EmptyState` exige désormais `rubric` : le typage refuse un état vide sans athlète. La tuile est rouge piste dans tous les thèmes, exprès : une tenue réglée sur un fond ne tient pas sur une carte dont la couleur change avec le thème. Tailwind 4 pose ses `translate-*` sur la propriété `translate`, pas `transform` : une animation de `transform` s'ajoute donc au centrage du dialogue sans le casser. Une sortie animée garde l'élément 150 ms à l'écran : un parcours qui clique « Corriger » puis remplit aussitôt un champ trouve deux champs, et un contrôle axe lancé pendant qu'un menu s'efface voit un texte à demi transparent ; `expectAccessible` attend donc la fin des animations en cours, et le parcours de confirmation d'âge la fermeture du dialogue. Le parcours de l'ossature a trouvé un défaut plus ancien : le logo n'offrait qu'une cible de 28 px. Non fait, par choix : les rubriques Athlètes et Planificateur restent en icône seule dans l'en-tête du coach sur téléphone ; les mettre dans la barre basse ou sous un menu « Plus » change la navigation.
Suite conseillée : B7.

## 2026-11-12, Claude, lot B5 : page d'accueil et site

Fait : le film passe de 680 à 300 svh sur téléphone et 450 sur ordinateur, et devient un relais (`jump-film-pose.ts`, `jump-film.tsx`) : Inès aux haies, Malo à la perche, Noé à la hauteur, chacun dans son monde ; captures en une colonne sur téléphone, qui glissent à leur place au défilement ; bande du groupe (`group-band.tsx`) ; tarifs en cartes sur téléphone et tableau replié sous « Tout comparer » (`pricing.tsx`, donc aussi `/tarifs` et `/abonnement`) ; six questions du centre d'aide sur la page d'accueil (`help/questions.tsx`) ; athlètes du groupe sur la page introuvable et la page hors ligne (PR `feat/landing-stade`).
Vérifié : `tests/jump-film-relay.test.ts` (ordre du relais, pas de saut dans une scène, pieds au-dessus de la piste, perche plantée, habillage de chaque athlète dans chaque monde) ; les 200 poses de référence du saut en hauteur n'ont pas bougé ; `e2e/landing.spec.ts` sur téléphone et ordinateur (titre et bouton dans le premier écran, hauteur du film, relais, un seul geste joué à la fois, tarifs, questions, axe, mouvement réduit) ; page regardée rendue à 390 et 1440 px. Poids mesuré sur le build de production, téléphone : scripts 360 vers 373 ko compressés, document 22 vers 28 ko, affichage du plus grand élément inchangé à la mesure près. Non vérifié : rien en production ; aucun vrai téléphone ; Safari et Firefox.
À savoir : le film garde `poseAt`, le saut en hauteur sur sa durée propre, et y entre en pleine course par `highJumpTime` : ses effets (anneau, traînée, barre, confettis) se règlent sur cette durée, pas sur celle du film. La séquence de la perche s'arrête avant le retournement : vu par la tranche, le corps ne se lit plus, et un test le refuse. Les couleurs des athlètes du film sont des variables posées sur leur groupe SVG, changées au changement de monde, sans rendu React. Le film plus court rapproche les premières captures : sur téléphone, trois images (128 ko) se chargent désormais dès l'ouverture, en différé, sans bloquer l'affichage. `SURFACES` compte deux fonds de plus (bleu, citron) : chaque tenue a une couleur de repli, et la planche les montre. Un geste qui joue redessine sa scène à chaque image : la bande n'en joue qu'un à la fois, et aucun hors de l'écran.
Suite conseillée : B6. J4 posera l'aperçu du jeu après la ligne d'arrivée.

## 2026-11-12, Claude, lot B4 : transitions de page

Fait : enveloppe `src/components/ui/view-transition.tsx` (`PageTransition`, `Stay`) et `route-transition.tsx`, posées dans `AppShell` et dans la mise en page du site ; animations dans `globals.css`, sous « Transitions de page » ; l'écran d'attente `SheetSkeleton` porte désormais le même bandeau qu'un titre d'écran (PR `feat/view-transitions`).
Vérifié : `e2e/view-transitions.spec.ts` sur téléphone et ordinateur lit ce que le navigateur anime vraiment : fondu de 150 ms, bandeau et onglet actif en 200 ms, rien au-delà de 260 ms ni à la durée par défaut du navigateur, aucun fondu en changeant de semaine, plus rien qui dure en mouvement réduit, en-tête du site en place ; `tests/view-transition.test.tsx` ; images à mi-transition regardées à 4 % de la vitesse. Non vérifié : rien en production ; Safari et Firefox non regardés ; aucun essai sur un vrai téléphone.
À savoir : `<ViewTransition>` vient du React que Next embarque, pas du paquet `react` installé : l'enveloppe laisse passer ses enfants quand il manque, donc Vitest rend les pages sans rien changer ; les types viennent de `react/canary`. Une transition de vue ne part que si une frontière `<ViewTransition>` entre, sort ou se retrouve : le contenu est donc remonté par une clé égale au chemin, pas aux paramètres de recherche. Avec `loading.tsx`, la page d'arrivée affiche d'abord l'écran d'attente : un élément partagé ne se retrouve que s'il existe aussi dans cet écran, d'où le bandeau ajouté au squelette. C'est aussi pourquoi la carte de séance ne s'ouvre pas en écran de séance : la page de destination n'est pas là au moment de la navigation, et la précharger en entier montrerait à l'athlète une séance vieille de cinq minutes au plus ; reporté à B7, où la carte et l'écran changent de forme. React n'anime que ce qui est à l'écran : en bas d'une longue page, le bandeau ne participe pas. Le navigateur garde 250 ms par défaut sur tout ce qui n'est pas stylé : la racine est ramenée à 150 ms, et le parcours refuse toute durée de 250 ms. Deux éléments visibles du même nom font avorter la transition : un seul onglet actif visible à la fois, le parcours le vérifie. Effet de bord mesuré : React attend la fin d'une transition de vue avant d'appliquer la mise à jour suivante, donc le titre de l'onglet, que Next envoie à part, arrive parfois jusqu'à 185 ms après le contenu (jamais sur `main`, deux essais sur huit ici, à l'arrivée d'un athlète). `expectAccessible` attend donc un titre avant de juger la page ; l'annonce de changement de page aux lecteurs d'écran peut alors lire le titre de l'écran au lieu du titre de l'onglet.
Suite conseillée : la revue de la planche (F17), puis B5 ; B6 peut faire tracer les lignes du bandeau à l'arrivée.

## 2026-11-11, Claude, lot B3 : six gestes, six athlètes, motifs de piste

Fait : `packages/mascot` porte le corps des athlètes (`rig.ts` : mains, trois visages, quatre coiffures, dossard), les accessoires (`props.ts`) et un geste complet par épreuve (`hurdles`, `pole-vault`, `triple-jump`, `discus`, `long-jump`, `high-jump-event`, réunis dans `events.ts`) ; `packages/design-tokens/src/athletes.ts` porte les teints, les cheveux, les tenues et la règle qui habille chaque athlète selon le fond ; côté web, `Athlete`, `EventScene`, les motifs de `track.tsx` et la planche `/admin/mascotte` (PR `feat/gestes-epreuves`).
Vérifié : 87 tests dans le paquet (aucun saut d'une image à l'autre, pieds au-dessus du sol, appel sans mordre, appuis du triple saut sur le bon pied, perche qui plie sans s'allonger, bassin au-dessus de la barre, disque dans la main jusqu'au lâcher) ; `tests/athlete-colors.test.ts` sur les dix-huit couples athlète et fond ; `e2e/mascot-board.spec.ts` sur téléphone et ordinateur (axe, pas de défilement horizontal, lecture à la demande, mouvement réduit, refus d'un coach ordinaire) ; planche regardée rendue à 390, 768 et 1440 px. Non vérifié : rien en production ; aucun geste vu sur un vrai téléphone ; les gestes n'ont été jugés qu'à l'œil, sur des planches-contact, par l'agent.
À savoir : le squelette de base (`SKELETON`) n'a pas bougé, donc le film, la mascotte actuelle et le mobile dessinent le même personnage qu'avant ; un athlète du groupe passe par `rig()` puis `svgAthlete` ou `drawMascot({ bones })`. Entre deux clés, un pied posé glisse ou s'enfonce : `planted` et `sandFrame` déduisent le bassin du pied à chaque image, et les tests l'exigent. Les haies ne sont pas des clés dans le temps mais dans l'espace : la foulée avance avec le corps, donc les pieds ne patinent pas. Mesurer une couleur contre un fond par la luminance ne suffit pas : le premier teint hâlé avait la clarté de la piste ; la règle est un écart Oklab d'au moins 0,12. Dans un parcours, un compte administrateur ne s'inscrit qu'une fois : la planche a ses deux adresses dans `ADMIN_EMAILS` de `playwright.config.ts` et un seul test par écran. Choix à faire valider : prénoms, cheveux blonds de Malo, chiffres du dossard en traits droits.
Suite conseillée : la revue de la planche par le fondateur (F17), puis B4 ou B5 ; J2 peut dessiner les haies avec `CLIPS.hurdles` et `drawMascot`.

## 2026-11-11, Claude, CI : délai maximal et dépôts Ubuntu

Fait : `ci.yml` plafonne la tâche `quality` à 45 minutes et l'installation des navigateurs à 10 ; une étape « Dépôts Ubuntu, résolution de secours » précède cette installation (PR `fix/delai-ci`).
Vérifié : sur un serveur GitHub, pendant la panne, l'étape de secours suivie de `playwright install --with-deps chromium webkit` aboutit en 64 secondes ; sans elle, la même commande ne finit pas. Non vérifié : le plafond de 45 minutes n'a jamais eu à se déclencher.
À savoir : le 11 novembre 2026, à partir de 13 h 48 UTC environ, une panne DNS de Canonical a privé tous les serveurs GitHub des dépôts Ubuntu (ticket 15296 de `actions/runner-images`). apt réessaie alors chaque paquet pendant des heures sans échouer : la CI de la PR du lot B1 est restée figée 1 h 27, puis de nouveau après relance. Le résolveur d'Azure ne répondait plus pour ces trois noms, un résolveur public si : l'étape de secours écrit leur adresse dans `/etc/hosts`, et seulement quand la résolution normale échoue. apt vérifie la signature des paquets, donc l'adresse d'origine ne change rien à leur intégrité. Relancer une CI figée ne sert à rien tant que la cause dure : lire d'abord le journal de l'étape. Les autres workflows n'installent rien par apt.
Suite conseillée : aucune. Si l'étape de secours affiche un avertissement, c'est qu'aucun serveur ne résout plus les dépôts : attendre.

## 2026-11-11, Claude, lot B1 : jetons de mouvement

Fait : `packages/design-tokens/src/motion.ts` (huit durées, trois courbes, pas de cascade) et son miroir dans `globals.css` ; toutes les animations de la feuille de styles lisent ces jetons et sont déclarées sous `no-preference` ; filet de mouvement réduit en fin de feuille ; règle de lint `tartan/no-raw-motion` ; aide `expectNoMotion` ; miroir des couleurs étendu à toute la feuille ; CSS mort retiré (`demo-*`, `jump-range`, `film-frame`) (PR `feat/jetons-mouvement`).
Vérifié : `tests/design-tokens.test.ts` (28 cas) rapproche chaque couleur d'un jeton, refuse une durée ou une courbe en dur, une animation hors `no-preference`, une classe ou une animation sans usage ; `e2e/reduced-motion.spec.ts` sur téléphone et ordinateur ; sans le filet, trois de ses quatre parcours échouent ; types, lint, design, suite web et e2e. Non vérifié : rien en production ; aucun essai avec le réglage « réduire les animations » d'un vrai téléphone.
À savoir : Tailwind n'émet que les variables de thème utilisées : les jetons de mouvement sont dans un bloc `@theme static`, sinon `--ease-elan` manquait à l'exécution. Le navigateur réécrit `200ms` en `.2s` : comparer des millisecondes. Une animation ramenée à 0,01 ms reste « en cours » une image : `motionOn` attend deux images avant de juger. Les durées du film ont bougé de 40 ms au plus (460 vers 420, 220 et 240 vers 260) ; la célébration garde ses 1 150 ms, lus aussi par `victory.tsx`. Sans mouvement, `.victory` est en `display: none` : elle ne peut pas rester posée sur l'écran. Les classes composées dans le code (`world-${…}`, `victory-piece-${…}`) sont reconnues par le test du CSS mort à leur préfixe suivi d'une interpolation. Le détecteur de design refuse une courbe qui dépasse sa cible (`bounce-easing`) : « impulsion » est une courbe d'entrée et de sortie, sans rebond. Les jetons ne sont pas encore lus par l'application mobile.
Suite conseillée : B3 (six épreuves et composants de piste), qui modifie `globals.css` et les jetons à la suite de ce lot ; B4 pour les transitions de page, déjà couvertes par le filet.

## 2026-11-11, Claude, lot A7 : paiement de bout en bout en sandbox

Fait : T03. `tests-sandbox/payment-cycle.test.ts` joue le cycle de vente contre la sandbox Stripe : Checkout ouvert, carte de test, essai, premier prélèvement, facture, e-mails, remboursement partiel depuis la console, résiliation, retour en Découverte ; et la fin d'essai avec validation bancaire. `tests-sandbox/sdk-over-cli.ts` fait passer le réseau du SDK Stripe par la CLI et sert la vraie route du webhook à `stripe listen` (PR `test/stripe-sandbox`).
Vérifié : les quatre tests de la recette sandbox passent le 11 novembre 2026, trois fois de suite pour le nouveau fichier ; aucun événement signé refusé ni en erreur ; types et lint. Non vérifié : rien en production, aucun vrai paiement ; la page Checkout hébergée, le portail, la TVA et les litiges ne sont pas joués.
À savoir : cette recette est hors de `pnpm test` et de la CI ; commande dans `docs/plans/stripe.md`. Le Checkout réel ouvre un essai de 14 jours : pour obtenir une facture payée, le test termine l'essai par `trial_end: now`. Un abonnement créé « incomplet » par l'API n'est jamais rattaché à l'espace, donc son e-mail de validation bancaire est écarté comme obsolète : ce n'est pas un défaut, Checkout traite ce cas sur sa propre page ; le cas réel est la fin d'essai, qui est celui du test. Les e-mails de facturation partent dès la mise en file : ne pas vider la boîte de test avant de les compter. `tests-sandbox/stripe-cli.ts` porte l'identifiant du compte sandbox en clair, ce que les règles du dépôt public interdisent : il est dans l'historique depuis la V1.1, à décider par le fondateur (le passer en variable ne l'efface pas de l'historique). Aucun défaut de l'application trouvé dans ce lot.
Suite conseillée : la porte 10 est franchie. Côté agent il reste A13 (après F15) ; sinon la direction artistique (B1, B3) et le jeu (J2). Côté fondateur : F1 à F9, puis la recette réelle (A14).

## 2026-11-11, Claude, lot A6 : suppression de compte et connexion Apple et Google

Fait : T07 et T08. `e2e/account-deletion.spec.ts` supprime un compte par le client de l'app native, sur un vrai serveur ; `tests/auth-social.test.ts` (13 cas) couvre l'activation par variables, le parcours OAuth Google de bout en bout et la révocation Apple ; flux Maestro `apps/mobile/.maestro/destructive/account-delete.yml` et son identifiant `delete-confirm-word` sur le champ de confirmation (PR `test/compte-social`).
Vérifié : parcours de suppression sur téléphone et ordinateur (compte, sessions des deux appareils et espace effacés, ancien mot de passe refusé, l'athlète garde son compte) ; le test de liaison échoue quand on coupe la liaison dans `auth.ts` ; types, lint, suite web. Non vérifié : le flux Maestro n'a jamais été exécuté ; aucune connexion Apple ou Google réelle, les deux sont éteintes en production.
À savoir : aucun défaut trouvé dans ce lot. La configuration de Better Auth se lit au chargement du module : pour la tester sous d'autres variables, `vi.stubEnv`, `vi.resetModules`, puis import dynamique de `@/lib/auth`. Dans le parcours par code, Better Auth lit le jeton d'identité de Google sans en vérifier la signature, car il vient de l'échange serveur à serveur : le test remplace donc seulement cet échange. Un compte au mot de passe jamais vérifié n'est pas rejoint par Google (`requireLocalEmailVerified`, valeur par défaut de la bibliothèque) : c'est ce qui empêche de piéger l'adresse d'un autre ; un test le fige. La révocation Apple ne part que si un jeton de rafraîchissement est conservé, ce que la connexion native ne fait pas (M6).
Suite conseillée : A7 (T03), qui demande la session Stripe CLI du fondateur (F16). Sinon A13 après F15, ou la direction artistique (B1).

## 2026-11-11, Claude, lot A5 : actions d'administration et export comptable

Fait : T05 et T06. `tests/admin-console-actions.test.ts` (24 cas) appelle les actions serveur de la console ; `tests/admin-accounting-export.test.ts` (6 cas) appelle le handler de l'export. Deux défauts corrigés : la route d'export laissait remonter le refus, donc répondait 500 au lieu de 401 ou 403 ; la page des revenus préchargeait l'export à chaque visite par un lien Next, remplacé par un lien de téléchargement (PR `test/admin-actions`).
Vérifié : les six tests d'export échouent sur l'ancienne route et passent sur la nouvelle ; la route est entrée dans la matrice d'accès, qui n'a plus aucune route reportée ; parcours `e2e/admin-console.spec.ts` étendu au téléchargement, sans préchargement ; types, lint, suite web (1 687 tests). Non vérifié : rien en production ; aucun remboursement ni aucune résiliation réels.
À savoir : pour tester une action serveur hors de Next, il suffit de remplacer `next/headers` (en-têtes portant le cookie d'une vraie session) et `next/cache` ; session, vérification de passkey et service restent réels. Le SDK Stripe n'ajoute pas de clé d'idempotence quand `maxNetworkRetries` vaut 0. Dans la matrice d'accès, une ligne placée après les routes qui ferment les sessions reçoit 401 pour tout le monde : mettre les nouvelles lignes en tête. Constat laissé en l'état : accorder une offre, supprimer un compte, résilier et prolonger un essai n'exigent qu'une passkey vérifiée dans les 12 heures ; seul le remboursement exige dix minutes. L'export classe les factures par date d'encaissement en UTC : une facture encaissée le 31 décembre après 23 h, heure de Paris, tombe dans l'année suivante. Les textes de la page des revenus sont passés dans `m.admin.revenue` ; il reste 267 textes gelés dans 46 fichiers.
Suite conseillée : A6 (T07, T08), puis A7 quand la session Stripe CLI est ouverte.

## 2026-11-11, Claude, lot A12 : centre d'aide

Fait : page publique `/aide` (37 questions en huit thèmes numérotés comme des couloirs), sa version sans offre pour l'app native (`/mobile/aide`), « Aide » dans le menu Réglages de chaque écran avec deux repères propres à l'écran, lien « Aide » dans le pied du site, les réglages et les réglages du mobile (PR `feat/aide`).
Vérifié : `tests/help.test.ts` (huit cas), parcours `e2e/help.spec.ts` sur téléphone et ordinateur avec axe, clavier et mouvement réduit, `/aide` regardée rendue à 390, 768 et 1440 px, `/mobile/aide` sans prix ni lien de vente, types, lint, design, suite web. Non vérifié : rien en production ; la ligne « Aide » du mobile n'a pas été vue sur appareil ; l'ouverture des liens dans un autre onglet n'a pas été essayée dans la PWA installée.
À savoir : aucune route d'API, aucune donnée, aucune migration : le centre d'aide est une page statique. Les textes sont dans `m.help`, la structure dans `apps/web/src/features/help/content.ts` ; un test échoue si une question écrite n'est pas classée. Chaque réponse a été vérifiée dans le code avant d'être écrite. `docs/exploitation/support.md` disait à tort qu'un propriétaire devait transmettre son espace avant de supprimer son compte : l'espace revient au plus ancien autre coach, ou disparaît. Les annonces n'ont pas de commentaires. `LaneNumber` (`src/components/lane-number.tsx`) est le premier motif « numéro de couloir » partagé : le lot B3 le reprend. Instabilité vue une fois sur 150 parcours : sous WebKit, `createCoachSpace` n'a pas trouvé la case des conditions après « Continuer » (`e2e/terrain.spec.ts`, mineur refusé) ; rejoué seul, le fichier passe. `expo-doctor` est désormais fixé en 1.21.6 dans `mobile-native.yml` : la 1.21.7, sortie le jour même, ne démarre pas ; à relever quand une version saine paraît.
Suite conseillée : A5 à A7, puis A13 quand F15 est décidé. Les questions fréquentes de la page d'accueil (lot B5) se tirent de `helpThemes()`.

## 2026-11-11, Claude, lot A11 : arrivée de l'athlète

Fait : e-mail de bienvenue à la première arrivée dans un espace ; rappel unique d'une invitation nominative sans réponse, avec opposition par adresse ; encart d'accueil sur `/aujourdhui` pendant la première semaine, qui déclenche tout de suite le bandeau d'installation et de notifications (PR `feat/accueil-athlete`).
Vérifié : `tests/athlete-arrival.test.ts` (sept cas), registre et documentation contrôlés par test, parcours `e2e/athlete-welcome.spec.ts` sur téléphone et ordinateur avec axe, encart regardé rendu à 390, 768 et 1440 px, types, lint, design, suite web. Non vérifié : aucun envoi réel ; le bandeau d'installation n'a pas été vu sur un vrai téléphone.
À savoir : pas de migration, l'accueil se déduit de la date d'arrivée et de l'absence de séance validée, et se referme sur l'appareil. Il n'y a pas d'écrans d'installation en plus : le bandeau existant (`install-banner.tsx`) faisait déjà ce travail après une première action. Le rappel compte ses trois jours depuis la dernière action sur l'invitation, donc un renvoi par le coach le repousse. L'opposition d'une personne invitée met son adresse en liste de blocage : un coach qui la réinvite n'en est pas averti. Le webhook Stripe de production écoute les 15 événements (constaté par l'API le 11 novembre).
Suite conseillée : A12, puis A5 à A7.

## 2026-11-11, Claude, schéma Prisma réaligné sur les migrations

Fait : `schema.prisma` décrit de nouveau la base que produisent les migrations. Trois identifiants (`athlete_consents`, `email_outbox`, `external_deletions`) sont générés par la base, comme leurs migrations l'avaient posé ; la clé étrangère de `checkout_intents` porte la même règle de mise à jour qu'en base. Aucune migration : seul le schéma change (PR `fix/ecart-schema-migrations`).
Vérifié : `prisma migrate diff` vide sur une base neuve migrée ; `prisma migrate dev` rend la main sans demander de nom ; `tests/schema-migrations.test.ts` échoue sans le correctif et passe avec ; types, lint, toute la suite web. Non vérifié : rien en production, où la base ne change pas.
À savoir : le nouveau test compare le schéma à la base de test reconstruite par les migrations. S'il échoue, le script qu'il affiche est soit la migration qui manque, soit le signe d'une erreur dans le schéma. Après avoir tiré `main`, relancer `corepack pnpm install` : un paquet ajouté par une autre branche fait sinon échouer les tests au chargement.
Suite conseillée : A11.

## 2026-11-11, Claude, fusions et lots des sessions parallèles

Fait : PR 53 à 63 fusionnées par l'agent, avec l'accord du fondateur, CI verte pour chacune. Quatre lots faits par des sessions parallèles, dont les entrées n'avaient pas pu être écrites ici : A1 (personas et matrice d'accès, PR 57), A2 (tests des webhooks Stripe et RevenueCat, PR 54), B2 (squelette unique de la mascotte, PR 62), J1 (simulation déterministe et 110 m haies, PR 56).
Vérifié : après chaque série de fusions, `/api/v1/version` sert le dernier commit de `main`, `/api/health` répond 200, Vercel ne remonte aucune erreur nouvelle ; film de la page d'accueil vu en production à 375 px avec le nouveau squelette, curseur de la frise mobile. Non vérifié : mascotte mobile sur appareil ; migration `profiles.email_tips` constatée seulement par la santé de l'application.
À savoir : deux PR vertes séparément peuvent se contredire une fois fusionnées. C'est arrivé entre A1 et A2 (matrice d'accès attendant 400, route répondant 503), `main` est resté rouge jusqu'à la PR 61. Avant de fusionner des branches parallèles, fusionner `main` dans la suivante et relancer les tests. `next-zod-route` valide avant d'authentifier : un test d'accès exige une requête valide. Pour tester Stripe sans mock de service, remplacer seulement le transport du SDK. Plusieurs sessions partagent `tartan_test`, `tartan_e2e` et le port 3100 : donner à chacune sa base par `TEST_DATABASE_URL` et `E2E_DATABASE_URL`. Dans le film, les os sont à plat sous le groupe du corps, repérés par `data-bone` ; une classe qui anime un os se pose sur un groupe intérieur.
Suite conseillée : A11, A12, puis A5 à A7. Côté jeu, une deuxième épreuve (J5) ; côté mascotte, les cinq autres gestes (B3).

## 2026-11-11, Claude, lot A10 : e-mails d'activation

Fait : séquence d'activation du coach à J+1, J+3 et J+7 sur la prochaine étape manquante ; e-mail de plafond presque atteint ; préférence « conseils » avec désinscription en un clic et réglage ; migration additive `profiles.email_tips` (PR `feat/emails-cycle-de-vie`).
Vérifié : tests du domaine, `tests/lifecycle-emails.test.ts` (sept cas), registre et documentation contrôlés par test, types, lint, design. Non vérifié : aucun envoi réel ; la tâche de 9 h n'a jamais tourné en production avec ces deux travaux ; réglage « conseils » non regardé rendu.
À savoir : la reconquête n'est pas construite, c'est de la prospection et elle attend F4. Pas d'e-mail « essai sans activation » : la séquence le couvre. La migration est écrite à la main, `prisma migrate dev` restant bloqué par l'écart de schéma noté dans ETAT. Le test du registre échoue tant qu'un nouvel e-mail n'est pas décrit dans `docs/reference/emails.md` : c'est voulu.
Suite conseillée : A11, puis A12.

## 2026-11-11, Claude, lot A9 : premiers pas du coach

Fait : règle pure des premiers pas (`packages/domain/src/onboarding.ts`), guide « Pour démarrer » du suivi passé à quatre étapes avec compteur ; création de l'espace en trois temps ; textes de l'onboarding sortis du code (PR `feat/premiers-pas-coach`). `docs/reference/onboarding.md` corrigé : il disait à tort que rien ne guidait le coach, alors que le guide existait déjà.
Vérifié : tests du domaine, types, lint, design ; parcours Playwright `age-confirmation`, `training-profile` et `billing-alert` en local, sur téléphone et ordinateur ; onboarding regardé rendu à 390 et 1440 px. Non vérifié : rendu à 768 px ; aucun coach réel n'a joué le parcours ; suite Playwright complète laissée à la CI.
À savoir : pas de migration, le guide se déduit toujours de l'état réel. Les boutons « Continuer » et « Créer mon espace » portent chacun une clé : sans elle, React transforme le bouton cliqué en bouton d'envoi pendant le clic et soumet le formulaire. Les parcours e2e passent par `nextOnboardingStep`. `pnpm db:migrate` demande un nom de migration à cause d'un écart ancien entre le schéma et les migrations (voir ETAT) : utiliser `prisma migrate deploy` en local. Le lanceur d'Impeccable est refusé à l'exécution sur ce poste : lire sa référence `craft-floor.md` à la main.
Suite conseillée : A10, qui lit `coachNextStep`.

## 2026-11-11, Claude, lot A8 : registre des e-mails

Fait : registre unique des 25 e-mails avec catégorie (`email-registry.ts`), exigé par `sendEmail` ; un rebond bloque tout, une plainte ou une désinscription épargne les e-mails de sécurité ; adresse qui rebondit annoncée au formulaire de connexion ; invitations passées par la file ; genre inconnu marqué en échec ; objets d'e-mail dans `packages/i18n` (PR `feat/email-registry`).
Vérifié : `tests/email-registry.test.ts` (douze cas), toute la suite web (847 tests), types, lint, design. Non vérifié : aucun envoi réel ; le lien de connexion, seul e-mail éprouvé en production, garde son envoi direct mais passe désormais par le contrôle de blocage avant le rendu ; Resend tient sa propre liste de suppression et peut refuser un envoi que Tartan laisse passer.
À savoir : le contrôle de blocage tourne aussi en local et en test, avant le rendu. La réinitialisation de mot de passe avale volontairement une adresse qui rebondit, pour ne pas révéler l'existence d'un compte. La file ne garde jamais le lien d'une invitation. `flushEmailOutbox` accepte une clé pour ne traiter qu'une ligne.
Suite conseillée : A9, puis A10.

## 2026-11-11, Claude, lot A4 : finitions du paiement

Fait : événement `invoice.payment_action_required` et son e-mail ; bandeau de paiement à régulariser dans tout l'espace coach, pour le propriétaire ; un message de plafond atteint mène aux offres ; liste des factures sur `/abonnement` ; rattrapage horaire élargi à 200 espaces dans un budget de 40 s ; CGV qui lisent les plafonds dans `plans.ts` (PR `feat/paiement-finitions`).
Vérifié : `tests/payment-action-required.test.ts` (dix cas), suites de facturation et d'e-mails, types, lint, design ; CGV regardées rendues en local à 390 px. Non vérifié : aucun événement réel de Stripe, la validation 3-D Secure n'a jamais été jouée ; le parcours `e2e/billing-alert.spec.ts` (bandeau, factures, axe à 390 px) est écrit mais n'a pas tourné en local, le port 3100 étant pris par une autre session : la CI le joue.
À savoir : le webhook de production ne reçoit pas le nouvel événement tant que `stripe-setup` n'est pas relancé (F14) ; la console l'affiche. Un incident de paiement n'envoie qu'un e-mail : celui de validation remplace « paiement échoué » s'il est en file dans la même heure, et s'efface si « paiement échoué » est déjà parti. Le lien vers les offres est reconnu par le texte du message de plafond, pour ne pas toucher vingt appels.
Suite conseillée : A8, puis A9.

## 2026-11-11, Claude, lot A3 : garde-fous de direction artistique

Fait : trois règles ESLint locales (`apps/web/eslint-rules`) : couleur brute, palette Tailwind par défaut, texte en dur dans le JSX et les attributs de libellé. 20 couleurs brutes corrigées (écrans vidéo, mode séance, ombres, page de paiement Stripe) ; rôles `on-ink`, `shadow-float` et `shadow-float-strong` ajoutés au thème (PR `feat/garde-fous-da`).
Vérifié : tests des règles, miroir des jetons, types, lint, design ; couleurs et ombres calculées identiques à l'ancien rendu, relevées dans le navigateur. Non vérifié : la suite Playwright complète n'a pas tourné en local, cinq sessions partageant le port 3100 et la base `tartan_e2e` ; elle tourne en CI.
À savoir : 274 textes hérités sont gelés dans `eslint-suppressions.json`, que le lint tolère sans jamais l'agrandir ; un test plafonne ce volume. Le lint passe `--pass-on-unpruned-suppressions` pour que des PR parallèles ne se bloquent pas ; `lint:prune` retire les entrées devenues inutiles. Dans une scène encre, le blanc s'écrit `text-fg` ; hors scène, sur un aplat encre, `text-on-ink`.
Suite conseillée : A4, puis A8.

## 2026-11-11, Claude, plan de fin de projet et documentation

Fait : audit du code, des écrans et de la documentation ; plan en lots approuvé par le fondateur (vente A1 à A13, direction artistique B1 à B9, ajouts C1 à C3, jeu J1 à J10) ; documentation remise à plat (PR `docs/remise-a-plat`). `PRODUCT.md` et `DESIGN.md` portent les décisions du 11 novembre. Nouveaux documents : direction artistique, incident, support, e-mails, onboarding.
Vérifié : liens entre documents contrôlés par script ; types, lint, tests et design après la correction de la signature des e-mails (« Yodev, entreprise individuelle »). Non vérifié : rien n'a été éprouvé en réel, aucun lot de code n'est commencé ; les chemins cités comme « à créer » n'existent pas encore.
En cours ou abandonné : rien.
À savoir : les anciennes tâches d'agent A1 à A12 sont renumérotées. A1 est devenu les lots A1, A2, A5, A6, A7 ; A2 et A4 le lot A13 ; les tâches mobiles M1 à M6 ; l'IA P1 et P2. La file d'e-mails expire tout message de plus de 24 h : une séquence se met en file le jour dû. Les liens de connexion ne passent pas par la file. La simulation du jeu doit rester en arithmétique entière. Les anciens audits non suivis ont quitté le dépôt.
Suite conseillée : A1 et A2 en parallèle, puis A3.

## 2026-11-09, Claude, remise en état et passation

Fait : webhook Mux réparé et rattrapage horaire (PR 48). Console Configuration, tarifs sur la landing, accord OpenAI, CGV, correctifs de l'audit des frontières (PR 49). Enrôlement de la passkey réparé (PR 50). Préparation des stores (PR 51). Documentation refondue.
Vérifié : lint, types, tests, design, Playwright sur build de production ; passkey créée en production ; vidéo réelle passée à prête.
Non vérifié : e-mails reçus, paiement réel, push, téléphones physiques.
À savoir : les variables Vercel de type Secret ne se relisent pas, même avec `vercel env run`. Une variable modifiée n'agit qu'après un nouveau déploiement. La bibliothèque de passkeys n'envoie pas `fetchOptions` à sa première requête.
Suite conseillée : A1, à commencer par T01.
