# Parcours d'arrivée du coach et de l'athlète

Ce que vit un nouvel utilisateur, de l'inscription à sa première action utile. Le critère du produit : un coach publie une première séance en quelques minutes, un athlète valide en moins de 10 secondes. Le niveau de preuve est dans [../ETAT.md](../ETAT.md).

## Se connecter : le lien ou le mot de passe

Le même formulaire sert à la connexion, à la création de compte et à l'invitation (`apps/web/src/features/auth/sign-in-form.tsx`). L'adresse d'abord, puis deux chemins visibles, de même taille : le mot de passe, ou un lien reçu par e-mail. Google et Apple s'ajoutent dessous quand ils sont configurés.

| Écran                                        | Chemin par mot de passe                                                       | Chemin par lien                   |
| -------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------- |
| `/connexion`                                 | « Continuer avec mon mot de passe », puis le mot de passe et « Se connecter » | « Recevoir un lien de connexion » |
| `/connexion?creer=1` (inscriptions ouvertes) | « Créer avec un mot de passe », puis le mot de passe et « Créer mon compte »  | « Créer avec un lien par e-mail » |
| `/i/[token]`                                 | Création par défaut ; « J'ai déjà un compte Tartan » passe à la connexion     | Identique dans les deux cas       |

- **Adresse à confirmer.** Un compte créé par mot de passe n'ouvre rien tant que son adresse n'est pas confirmée. L'écran d'attente rappelle l'adresse, propose de renvoyer le lien et de changer d'adresse, et dit quoi faire si rien n'arrive (`link-sent.tsx`). Le lien de confirmation connecte et ramène à la page demandée. Une connexion par mot de passe sur une adresse non confirmée ramène à cet écran, et le lien repart.
- **Lien envoyé.** Même écran d'attente. Le renvoi est possible après 30 secondes ; un refus du serveur (limite de débit) fait attendre une minute et le dit.
- **Rien ne révèle un compte.** Un mauvais mot de passe et une adresse inconnue donnent le même message, qui propose le lien. Créer un compte sur une adresse déjà inscrite donne le même écran d'attente qu'une adresse neuve : seul l'e-mail `account_exists` le dit, et le mot de passe saisi n'est pas enregistré.
- **Lien avant confirmation.** Si un compte créé par mot de passe est ouvert pour la première fois par un lien de connexion plutôt que par son lien de confirmation, la bibliothèque d'authentification retire le mot de passe posé avant la preuve de l'adresse. Le compte en redéfinit un dans les réglages.
- **Retour à la page demandée.** Une page de l'application ouverte sans session mène à `/connexion?next=…` (`requireSpace`, `signInPath` dans `apps/web/src/lib/return-path.ts`). Le proxy pose la page demandée dans un en-tête que le client ne peut pas imposer, et seuls les chemins internes sont gardés.
- **Limites de débit**, par adresse IP et par minute (`apps/web/src/lib/auth-rate-limit.ts`) : dix connexions ou demandes de lien, cinq créations de compte, cinq ouvertures de lien, trois renvois du lien de confirmation. Définir ou changer un mot de passe : cinq essais par compte en dix minutes.

### Définir et changer son mot de passe

Réglages, rubrique Connexion (`/reglages/connexion`) : les moyens du compte (lien, mot de passe, Google, Apple), puis le mot de passe. Service : `apps/web/src/server/credentials.service.ts` ; l'API du mobile est la même (`GET /api/v1/me/sign-in-methods`, `POST` et `PATCH /api/v1/me/password`, `POST /api/v1/me/password/confirmation`, `DELETE /api/v1/me/password-prompt`, contrats dans `packages/contracts/src/credentials.ts`).

- **Définir**, quand le compte n'en a pas. Si la connexion date de moins d'une heure, le mot de passe se choisit sur place. Sinon rien ne se saisit : un lien de confirmation part par e-mail, rouvre une session récente et ramène à la rubrique, formulaire prêt.
- **Changer** : le mot de passe actuel est demandé ; une case déconnecte les autres appareils, celui qui fait la demande reste connecté.
- Un e-mail prévient à chaque définition et à chaque changement.

## L'aiguillage d'un compte sans espace

Un compte connecté qui n'a encore aucun espace arrive sur `/bienvenue` (`welcome-choices.tsx`) : trois chemins de même rang, en une liste numérotée comme des couloirs.

| Choix                            | Mène à                                                                           | Fermé quand                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1. « Je suis coach »             | `/bienvenue/coach`, la création de l'espace ci-dessous                           | Inscriptions des coachs fermées : le choix reste visible, avec l'adresse de contact |
| 2. « Je m'entraîne seul »        | `/bienvenue/seul`, l'espace personnel                                            | Inscriptions des athlètes autonomes fermées : c'est le défaut, le fondateur les ouvre dans la console |
| 3. « J'ai un lien d'invitation » | Un champ qui accepte le lien entier ou le code qui suit `/i/`, puis l'invitation | Jamais                                                                              |

- Sous l'aiguillage, « Ton compte » : l'adresse connectée, « Se déconnecter » et « Supprimer mon compte » (`account-exit.tsx`). Un compte sans espace n'est jamais dans une impasse.
- Une offre choisie sur les tarifs (`?offre=`) mène directement à `/bienvenue/coach`.
- Les deux réglages (`signupMode`, `athleteSignupMode`) sont lus sans session par `GET /api/v1/signup-options`, pour l'app native. La création de compte de `/connexion?creer=1` s'ouvre dès que l'un des deux l'est.
- Un compte confirmé resté sans espace ni invitation reçoit une fois « Termine ton inscription », 24 heures après sa création ([emails.md](emails.md#athlète-autonome)).

## Le coach

1. `/connexion?creer=1` : inscription par mot de passe ou par lien, puis confirmation de l'adresse par e-mail.
2. `/bienvenue`, puis « Je suis coach » (`/bienvenue/coach`) : contrôle de l'âge et de l'ouverture des inscriptions.
3. Création de l'espace en trois temps, puis un quatrième, facultatif (`apps/web/src/features/onboarding/onboarding-form.tsx`). Les trois premiers tiennent sur une seule action serveur ; l'espace existe dès « Créer mon espace », et l'action mène au quatrième temps, sur sa propre page (`/bienvenue/inviter`, l'offre choisie sur les tarifs suit) : un rechargement n'y perd rien.

| Temps            | Contenu                                                                                | Requis                                          |
| ---------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1. À vos marques | Prénom, nom, date de naissance                                                         | Oui                                             |
| 2. Prêts         | Club ou indépendant, nom de l'espace, premier groupe, objectif du groupe               | Nom et groupe                                   |
| 3. Partez        | Disciplines, objectifs et matériel ; conditions d'utilisation                          | Conditions                                      |
| 4. Ton groupe    | Le lien du premier groupe à copier, son QR code, quelques adresses e-mail (20 au plus) | Rien : « Ouvrir mon espace » part à tout moment |

Chaque « Continuer » valide le temps affiché et porte le focus sur le titre du suivant. Entrée fait avancer d'un temps. Une erreur dans un temps précédent y ramène, comme « Corriger » sur la confirmation de la date. L'espace naît en offre Découverte, avec la bibliothèque d'exercices, des modèles de séance (`packages/domain/src/starter-library.ts`, `starter-templates.ts`) et son premier groupe. Un compte ne possède qu'un espace gratuit. L'invitation sur place (`invite-panel.tsx`) sert aussi à la carte et à la page des premiers pas.

4. Arrivée sur `/suivi`, ou sur `/abonnement` si le coach venait de `/tarifs`.
5. E-mail de bienvenue.

### Ce qui est gardé, et ce qui est déduit

Les étapes obligatoires ne sont pas stockées : elles se déduisent des faits réels de l'espace, par une règle pure que les e-mails d'activation lisent aussi (`packages/domain/src/onboarding.ts`). Les faits sont lus par `readCoachFacts` (`apps/web/src/server/onboarding.service.ts`), pour la carte comme pour les e-mails.

Ce que les faits ne disent pas est gardé par membre et par espace, dans `onboarding_states` : tour vu, accueil vu, carte refermée, fin fêtée, étapes facultatives écartées, écrans dont le repère a été vu. La ligne naît avec le membre, dans la transaction qui le crée (création de l'espace, invitation acceptée). Un membre arrivé avant ce suivi n'a pas de ligne, ou une ligne `guided = false` s'il referme quelque chose : il n'est ni guidé ni accueilli. Les comptes de démonstration (`seed.ts`, `demo-preparation.ts`) sont posés ainsi.

API, pour le web et le mobile : `GET` et `PATCH /api/v1/orgs/[orgId]/onboarding` (contrat dans `packages/contracts/src/onboarding.ts`), sous `requireOrgMember`. Chacun ne lit et n'écrit que les siens. Le web y envoie les gestes sans retour à l'écran (tour refermé, accueil refermé, carte facultative refermée, fête jouée) en `keepalive`, réponse lue jusqu'au bout : l'écriture part même si la page change ou se recharge aussitôt. Un rechargement plus rapide que l'écriture côté serveur peut encore montrer l'élément une fois. Le repère vu, noté à l'arrivée sur l'écran, passe par l'action serveur.

### Le tour de piste

À la première arrivée sur `/suivi`, un dialogue présente les sept grandes fonctions (`coach-tour.tsx`, `tour-features.ts`) : suivi, calendrier et constructeur, exercices, vidéo, planificateur, progression et phases, annonces. Chaque étape porte son numéro de couloir, l'athlète de sa rubrique, ce qu'elle apporte en une phrase, et le produit tel qu'il est : une vraie capture sur données fictives (`src/features/landing/images`, `src/features/onboarding/captures`, provenance documentée et contrôlée par `tests/onboarding-captures.test.ts`), ou, pour les exercices, le vrai guide animé d'une fiche du catalogue.

- Refermable à tout moment : Échap, la croix, « Commencer » à la dernière étape, ou « Y aller ». Il ne s'ouvre seul qu'une fois (`tourSeenAt`), et attend qu'un message encore affiché (« 2 invitations envoyées ») soit parti : il ne le recouvre ni ne le coupe.
- Rouvrable depuis l'aide de l'écran (« Revoir le tour de piste ») et depuis la page des premiers pas.
- Au clavier : le focus reste dans le dialogue, les flèches passent d'une étape à l'autre, une barre de sept couloirs y mène directement. En mouvement réduit, rien ne glisse.

### La carte « Pour démarrer »

Sur `/suivi` et sur `/premiers-pas` (`coach-guide.tsx`). Le tour de piste (`TrackLap`) montre la part courue, que la carte dit aussi en toutes lettres (« 2 étapes faites sur 5 »). La prochaine étape est marquée.

| Étape                            | Faite quand                                   | Sur place                                                                                                |
| -------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Compléter ton profil             | Le profil a une photo ou un avatar            | Lien vers Réglages, Profil                                                                               |
| Inviter tes athlètes             | Une invitation existe ou un athlète a rejoint | Lien du groupe, QR code, adresses, dans la carte                                                         |
| Créer une première séance        | Une séance existe                             | Deux modèles de départ (`/seances/nouvelle?modele=…`), une page vierge, le planificateur s'il est ouvert |
| Publier la séance                | Une séance est publiée                        | Calendrier                                                                                               |
| Recevoir une première validation | Un athlète a validé                           | « Essaie avec ton propre téléphone » : le lien et le QR code du groupe, à ouvrir avec une autre adresse  |

Étapes facultatives, sous « Pour aller plus loin », faites d'après les faits ou écartées d'un geste (« Écarter », « Reprendre ») : matériel de l'espace, première vidéo, première phase, installation de l'app (un appareil enregistré).

- Une étape avancée prouve les précédentes : une séance supprimée après une validation ne fait pas reculer la carte. Le profil se juge à part.
- « Refermer » la retire du suivi, sur tous les appareils (`dismissedAt`). Elle se retrouve dans le menu de l'engrenage et dans l'aide (« Premiers pas »), et « Remettre la carte sur le suivi » la rend.
- Un coach sans athlète ne voit plus une grille vide : la carte, et un état vide qui dit d'inviter, avec le lien.
- Un coach d'avant ce suivi garde l'ancienne règle : la carte jusqu'à sa première validation.

### La page des premiers pas

`/premiers-pas`, toujours accessible (menu de l'engrenage, aide de l'écran) : la carte entière, puis les sept fonctions avec leur état dans cet espace (athlètes, séances publiées, exercices, vidéos, planificateur ouvert ou non, phases, annonces) et un lien « Y aller » ; l'invitation sur place (`#inviter`), l'installation (`#installer`) et l'espace de démonstration (`#demonstration`).

### L'espace de démonstration

Un coach voit Tartan rempli avant d'inviter son groupe. « Voir un espace de démonstration », sur la page des premiers pas, ouvre un espace à part et y entre ; la carte « Pour démarrer » y mène tant qu'aucun athlète n'a validé. Drapeau : `DEMO_SPACE_ENABLED` (`src/lib/onboarding-paths.ts`).

- **Données.** Un espace marqué `organizations.is_demo`, dont le coach est l'unique membre (`demo_owner_id`, unique : un seul par coach) et qui s'efface à `demo_expires_at`. Huit athlètes fictifs en deux groupes, **sans compte** : aucun utilisateur créé, aucune adresse. Séances des quatre semaines passées à deux semaines à venir (les séances de départ), validations cohérentes, effort ressenti et détail des séries au squat, deux phases, tests de force, une blessure suivie, une note privée, trois annonces. Les règles et le contenu sont dans `packages/domain/src/demo-space.ts` ; les accords santé et vidéo des fiches portent la version `demonstration-fictive`.
- **Remise à zéro et suppression.** L'ouvrir à nouveau efface l'ancienne démonstration et en crée une neuve. Le coach la supprime d'un geste confirmé, depuis le bandeau ou depuis ses premiers pas ; la tâche horaire efface celles qui ont 14 jours (`purgeExpiredDemoSpaces`). Elle part aussi avec le compte.
- **Interface.** Sur chaque écran de la démonstration, en tête du contenu, un bandeau aux bords en pointillés : « Athlètes et données fictives », la date d'effacement, « Revenir à mon espace » et « Supprimer ». Les écrans immersifs (mode séance, analyse vidéo) n'en portent pas. Le sélecteur d'espace la nomme « … (démonstration) ». Ni tour de piste, ni carte des premiers pas : elle naît remplie. L'API du mobile (`/me`) ne la liste pas.
- **Coupé, service par service** (`src/server/demo-space-guard.ts`, un test chacun dans `tests/demo-space.test.ts`) : planificateur (colonne `ai_planner_enabled` éteinte, ni onglet ni invitation à payer), envoi de vidéo d'athlète et d'exercice, invitations (création, lien de groupe, renvoi, rappels ; une invitation forgée n'ouvre rien), notifications et push (`queueNotifications`), e-mails (file d'envoi, conseils d'activation, récapitulatif du dimanche, signalement), tâches des séances (publication programmée, séance manquée, question de la veille), facturation (offre, paiement, portail, rappels d'essai et d'échéance, plafonds, conservation vidéo, rapprochement Stripe), statistiques de la plateforme (`platform_daily_stats`, console d'administration) et analyses d'usage (mesure d'audience, satisfaction). La conservation laisse ses fiches sans compte à la purge de la démonstration.
- **Accès.** Service sous `requireOrgMember` ; `GET`, `POST` et `DELETE /api/v1/orgs/[orgId]/demo-space` pour les encadrants. Un membre d'un espace de démonstration autre que son propriétaire est refusé par `requireOrgMember` : aucun athlète réel ne la voit jamais.

### Les repères de première visite

Sous le bandeau de chaque écran du coach qui a une aide propre (`screen-help.ts`), la première phrase de cette aide, la première fois (`screen-hint.tsx`, `seenScreens`). Le repère ne recouvre rien, se referme d'un geste, et ne revient sur aucun appareil.

### La fin des premiers pas

Quand les cinq étapes sont faites, un grand moment (`celebration.tsx`) : le groupe passe la ligne d'arrivée, un athlète après l'autre, en 1 150 ms. Une seule fois (`celebratedAt`), même si la carte avait été refermée ; en mouvement réduit, le groupe est déjà arrivé. Le dialogue se referme d'un geste.

## L'athlète

1. Invitation nominative par e-mail, lien de groupe ou QR. Le coach peut renvoyer, révoquer, régénérer. Une invitation nominative sans réponse reçoit un seul rappel, trois jours plus tard.
2. `/i/[token]` : création du compte par lien ou par mot de passe, acceptation des conditions. Les accords santé et vidéo sont facultatifs, propres à la fiche, et chacun dit en une phrase ce qu'il change. Le plafond d'athlètes de l'offre est contrôlé à ce moment.
3. Les accords cochés sont écrits dans la transaction qui crée le membre (`recordJoinConsents`, `consent.service.ts`) : si l'un échoue, personne n'a rejoint et le lien n'est pas consommé (G15, `tests/onboarding.test.ts`).
4. E-mail de bienvenue, à la première arrivée dans l'espace.
5. Arrivée sur `/aujourdhui`.

Retirer l'accord santé efface les données de santé. Le parcours des mineurs est dormant.

### L'accueil sur `/aujourdhui`

Pendant la première semaine, et jusqu'à la première séance validée (`getAthleteWelcome`), un accueil nomme le groupe et le coach qui le suit, puis trois choses à savoir, chacune avec l'athlète de sa rubrique : ta séance et comment la valider, tes progrès, tes vidéos et ton coach (`athlete-welcome.tsx`, règle `athleteWelcomeMode`).

- **Rien ne retarde la séance.** Un jour de séance, la carte de séance et « J'ai fait la séance » restent en premier ; l'accueil se réduit à une ligne « Découvrir Tartan », dessous, qui l'ouvre à la demande. Un jour sans séance, il ouvre l'écran.
- « C'est parti » le referme d'un geste. L'état est gardé sur le compte (`welcomeSeenAt`) : il ne revient sur aucun appareil.
- L'installation sur l'écran d'accueil et les notifications sont armées dès l'accueil, même un jour de séance (`install-opportunity.ts`). Les notifications se demandent toujours par un bouton, jamais à l'ouverture.
- Mesuré par `e2e/onboarding.spec.ts` : de l'arrivée sur `/aujourdhui` à la validation confirmée, un seul geste, sous dix secondes.

### Après la première validation

Une carte facultative « Pour aller plus loin » (`athlete-extras.tsx`), sous les séances, regroupe : la photo ou l'avatar, la proposition de mot de passe (le même composant que ci-dessous), l'installation et les notifications (la même proposition que le bandeau, qui s'efface tant que la carte l'héberge). « Refermer cette carte » vaut pour tous les appareils.

### La proposition de mot de passe

L'athlète entré par un lien, sans mot de passe ni connexion Google ou Apple, voit sur `/aujourdhui` une carte « Un mot de passe pour revenir plus vite » (`apps/web/src/features/auth/password-prompt.tsx`) ; après sa première validation, elle passe dans la carte facultative.

- Elle vient après la séance du jour, jamais avant, et n'est ni un dialogue ni une étape : rien ne retarde la validation.
- « Définir un mot de passe » ouvre le champ dans la carte quand la connexion est récente ; sinon le bouton mène à Réglages, Connexion, où la confirmation par e-mail prend le relais.
- « Non merci » la referme pour de bon. L'état est gardé sur le compte (`profiles.password_prompt_dismissed_at`) : elle ne revient sur aucun appareil. Le réglage reste disponible dans Réglages, Connexion.

## Dans l'app native (iOS et Android)

Le même parcours, avec les mêmes API et les mêmes contrats (lot M1). Aucun prix, aucune offre payante, aucun lien d'achat.

- **Connexion** (`apps/mobile/app/(auth)/sign-in.tsx`, règles dans `src/lib/sign-in.ts`) : l'adresse, puis « Continuer avec mon mot de passe » et « Recevoir un lien de connexion », de même taille ; « Je n'ai pas encore de compte » passe à la création, dans le même ordre. L'écran d'attente (`src/features/link-sent.tsx`) rappelle l'adresse, renvoie le lien après 30 s (une minute après un refus), change d'adresse et dit quoi faire si rien n'arrive. Les liens de connexion et de confirmation reviennent dans l'app (`/callback`), connectée. Une invitation ouverte sans session mène à la création de compte.
- **Réglages** : un sommaire (`app/settings/index.tsx`) et neuf rubriques, sous-écrans de `app/settings/` (profil, connexion, notifications, apparence, confidentialité, espace, groupes, membres, aide), selon les droits du web (`src/lib/settings-rubrics.ts`) ; pas de rubrique Abonnement. L'ancienne adresse `/organization-settings` mène à la rubrique Espace.
- **Rubrique Connexion** (`app/settings/connexion.tsx`) : les moyens du compte, définir ou changer le mot de passe (l'actuel demandé, case « Déconnecter mes autres appareils »), déconnecter les autres appareils, se déconnecter. Une session de plus d'une heure ne définit rien : l'app envoie un lien de connexion qui la rouvre sur cette rubrique avec une session neuve (`/callback?next=/settings/connexion`, seul retour admis par `returnPathOf`), au lieu du lien de confirmation du web qui ouvrirait le navigateur.
- **Le coach** (`src/features/first-steps.tsx`) : la carte « Pour démarrer » sous le suivi (jamais devant la grille) tant que `guideVisible`, avec le tour de piste dessiné, la prochaine étape et son bouton, les étapes facultatives (Écarter, Reprendre) ; « Refermer » vaut pour tous les appareils. Le tour de piste devient sept écrans simples (`app/tour.tsx`), qui ne s'ouvrent jamais seuls : un bouton de la carte tant que `tourDue`, puis les premiers pas ; la fin fêtée une fois (`celebrationDue`). L'écran « Premiers pas » (`app/premiers-pas.tsx`, depuis Réglages, rubrique Aide) montre la carte entière, rouvre le tour et remet la carte sur le suivi. L'espace de démonstration reste à la web app, sans lien depuis l'app : celle-ci montre l'offre de l'espace. L'étape « Installer l'app » mène aux notifications du téléphone.
- **L'athlète** (`src/features/athlete-onboarding.tsx`) : l'accueil lu par `GET /api/v1/orgs/[orgId]/athlete/welcome` (le groupe et le coach, ou rien après une semaine ou une validation) et par `welcomeSeenAt`, pour un membre guidé seulement (`guided`, faux pour les comptes de démonstration de la graine), avec la même règle `athleteWelcomeMode` : un jour de séance, la ligne « Découvrir Tartan » sous la séance ; sinon l'accueil en tête. « C'est parti » le referme pour tous les appareils. La proposition de mot de passe vient après la séance ; après la première validation, la carte « Pour aller plus loin » (photo ou avatar, mot de passe, notifications) se referme pour de bon.
- **État** : chaque geste part en `PATCH /api/v1/orgs/[orgId]/onboarding` et s'affiche avant la réponse (`applyOnboardingPatch`, `src/lib/onboarding.ts`) ; un refus du serveur rend l'état d'avant.
- **Preuves** : tests unitaires du mobile (`sign-in`, `settings-rubrics`, `onboarding`, `avatar-photo`, `auth-callback`) ; flux Maestro `sign-in-smoke`, `account-password`, `settings-sections`, `account-avatar`, `athlete-welcome` (un athlète créé par la CI via le lien de son groupe ; la base vérifie ensuite que l'accueil a été refermé sur le simulateur).

### Invitation d'un compte existant

- Une invitation nominative montre l'adresse qu'elle vise avant tout formulaire. Ouverte avec un autre compte, elle le dit, avec l'adresse connectée et « Changer de compte », qui déconnecte et rouvre l'invitation, l'adresse visée déjà saisie (`switch-account.tsx`). Le texte du refus est dans `packages/i18n` (`m.invite.wrongAccount`).
- Une inscription par mot de passe lancée depuis une invitation, sur une adresse qui a déjà un compte : l'e-mail `account_exists` mène à `/connexion?next=/i/…`, qui rouvre l'invitation après la connexion.
- Accepter une invitation ne réécrit plus le nom du compte s'il en a déjà un : seule la fiche de cet espace prend le nom saisi.

## L'athlète autonome

Décision du 23 novembre 2026, plan dans [../plans/athlete-autonome.md](../plans/athlete-autonome.md).

1. `/connexion?creer=1`, confirmation de l'adresse, puis l'aiguillage de `/bienvenue` et « Je m'entraîne seul ».
2. `/bienvenue/seul`, en trois temps (`personal-signup-form.tsx`) : prénom, nom et date de naissance (adultes seulement, mêmes règles que le coach) ; disciplines et objectifs (facultatifs) ; conditions, et les deux accords facultatifs santé et vidéo.
3. Création de l'espace personnel (`createPersonalSpace`, `apps/web/src/server/personal-space.service.ts`, ou `POST /api/v1/me/personal-space`) : `organizations.kind = personal`, `personal_owner_id` unique (un seul par compte), offre `personal`, le compte comme unique membre avec le rôle athlète et sa fiche, la bibliothèque et les séances de départ, sa ligne `onboarding_states`, la bienvenue `personal_welcome` en file.
4. Arrivée sur `/aujourdhui`.

### Ce qu'il peut faire

- **Droits** (`personalScopeOf`, `packages/domain/src/permissions.ts`) : tous ceux d'un athlète, plus la planification pour sa seule fiche — séances et modèles (`manageSessions`), bibliothèque et listes (`editExercises`), tests de force, références, performances et phases (`recordPerformance`). Rien d'autre : ni invitation, ni gestion de fiches ou de groupes, ni notes privées, ni annonces, ni abonnement, ni réglage de l'espace. `requireOrgMember` refuse tout autre membre ; une invitation vers un espace personnel n'ouvre rien.
- **Navigation** : Aujourd'hui, Calendrier, Exercices, Progrès, Vidéos, et « Planifier ». Le constructeur, le calendrier, les modèles et le planificateur sont ceux du coach, dans un mode sans destinataires : le serveur remplace tout public par sa fiche (`forPersonalSpace`), et ne le notifie pas de ses propres séances. Publiée, une séance l'attend dans sa journée.
- **Progrès** : il note lui-même un test de force ou une performance (`#test-de-force`).
- **Exclu** : e-mails du coach, facturation et plafonds d'espace, question de la veille, compteurs d'espaces et de revenus de la console (`COACH_SPACES`). Tests : `tests/personal-space.test.ts`.

### Ses premiers pas

Règle pure `personalChecklist` (`packages/domain/src/onboarding.ts`), faits lus par `readPersonalFacts` : planifier une séance (un modèle, une page vierge ou le planificateur), la valider, noter une référence de force, installer l'app. Même mécanique que le coach : la carte « Pour démarrer » sur `/aujourdhui` (après la séance du jour, refermable), la page `/premiers-pas`, et les conseils `personal_activation` à J1, J3 et J7.

### Rejoindre un coach et partager son historique

- Il ouvre le lien de son coach, connecté : il devient athlète du groupe (fiche propre à cet espace) et garde son espace personnel. Le sélecteur d'espace montre « Mon entraînement » et le groupe du coach.
- Écran suivant, facultatif : `/partager-historique`, « Partager mon historique avec … », par cases (records, références de force, historique des séances) ; « Pas maintenant » ne partage rien. La santé n'est jamais une case.
- Le partage vit dans `history_shares` (`apps/web/src/server/history-share.service.ts`) : rien n'est copié, le coach lit l'espace personnel à travers lui. Chaque lecture revérifie le partage et les droits de l'espace du coach (`viewTracking`, fiche visible), et s'écrit au journal (`history_share_read`). Le coach le lit sur la fiche de l'athlète, section « Historique personnel partagé », en lecture seule ; il en est prévenu par l'e-mail `history_shared`.
- Retrait à tout moment dans Réglages, Confidentialité, « Historique partagé » : effet immédiat. Quitter l'espace du coach, ou supprimer son compte, emporte le partage.
- API pour l'app native : `GET` et `POST /api/v1/me/history-shares`, `DELETE /api/v1/me/history-shares/[orgId]`, `GET /api/v1/orgs/[orgId]/athletes/[athleteId]/shared-history`.

## Ce qui se mesure

Indicateurs du pilote, dans [commercialisation.md](../plans/commercialisation.md) : activation sous 7 jours, taux et délai de validation, athlètes actifs.
