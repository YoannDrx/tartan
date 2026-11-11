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
