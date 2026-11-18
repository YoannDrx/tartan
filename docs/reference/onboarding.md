# Parcours d'arrivée du coach et de l'athlète

Ce que vit un nouvel utilisateur, de l'inscription à sa première action utile. Le critère du produit : un coach publie une première séance en quelques minutes, un athlète valide en moins de 10 secondes. Le niveau de preuve est dans [../ETAT.md](../ETAT.md).

## Se connecter : le lien ou le mot de passe

Le même formulaire sert à la connexion, à la création de compte et à l'invitation (`apps/web/src/features/auth/sign-in-form.tsx`). L'adresse d'abord, puis deux chemins visibles, de même taille : le mot de passe, ou un lien reçu par e-mail. Google et Apple s'ajoutent dessous quand ils sont configurés.

| Écran | Chemin par mot de passe | Chemin par lien |
| --- | --- | --- |
| `/connexion` | « Continuer avec mon mot de passe », puis le mot de passe et « Se connecter » | « Recevoir un lien de connexion » |
| `/connexion?creer=1` (inscriptions ouvertes) | « Créer avec un mot de passe », puis le mot de passe et « Créer mon compte » | « Créer avec un lien par e-mail » |
| `/i/[token]` | Création par défaut ; « J'ai déjà un compte Tartan » passe à la connexion | Identique dans les deux cas |

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

## Le coach

1. `/connexion?creer=1` : inscription par mot de passe ou par lien, puis confirmation de l'adresse par e-mail.
2. `/bienvenue` : contrôle de l'âge et de l'ouverture des inscriptions. Inscriptions fermées : écran d'attente.
3. Création de l'espace en trois temps, puis un quatrième, facultatif (`apps/web/src/features/onboarding/onboarding-form.tsx`). Les trois premiers tiennent sur une seule action serveur ; l'espace existe dès « Créer mon espace », et l'action mène au quatrième temps, sur sa propre page (`/bienvenue/inviter`, l'offre choisie sur les tarifs suit) : un rechargement n'y perd rien.

| Temps | Contenu | Requis |
| --- | --- | --- |
| 1. À vos marques | Prénom, nom, date de naissance | Oui |
| 2. Prêts | Club ou indépendant, nom de l'espace, premier groupe, objectif du groupe | Nom et groupe |
| 3. Partez | Disciplines, objectifs et matériel ; conditions d'utilisation | Conditions |
| 4. Ton groupe | Le lien du premier groupe à copier, son QR code, quelques adresses e-mail (20 au plus) | Rien : « Ouvrir mon espace » part à tout moment |

Chaque « Continuer » valide le temps affiché et porte le focus sur le titre du suivant. Entrée fait avancer d'un temps. Une erreur dans un temps précédent y ramène, comme « Corriger » sur la confirmation de la date. L'espace naît en offre Découverte, avec la bibliothèque d'exercices, des modèles de séance (`packages/domain/src/starter-library.ts`, `starter-templates.ts`) et son premier groupe. Un compte ne possède qu'un espace gratuit. L'invitation sur place (`invite-panel.tsx`) sert aussi à la carte et à la page des premiers pas.

4. Arrivée sur `/suivi`, ou sur `/abonnement` si le coach venait de `/tarifs`.
5. E-mail de bienvenue.

### Ce qui est gardé, et ce qui est déduit

Les étapes obligatoires ne sont pas stockées : elles se déduisent des faits réels de l'espace, par une règle pure que les e-mails d'activation lisent aussi (`packages/domain/src/onboarding.ts`). Les faits sont lus par `readCoachFacts` (`apps/web/src/server/onboarding.service.ts`), pour la carte comme pour les e-mails.

Ce que les faits ne disent pas est gardé par membre et par espace, dans `onboarding_states` : tour vu, accueil vu, carte refermée, fin fêtée, étapes facultatives écartées, écrans dont le repère a été vu. La ligne naît avec le membre, dans la transaction qui le crée (création de l'espace, invitation acceptée). Un membre arrivé avant ce suivi n'a pas de ligne, ou une ligne `guided = false` s'il referme quelque chose : il n'est ni guidé ni accueilli. Les comptes de démonstration (`seed.ts`, `demo-preparation.ts`) sont posés ainsi.

API, pour le web et le mobile : `GET` et `PATCH /api/v1/orgs/[orgId]/onboarding` (contrat dans `packages/contracts/src/onboarding.ts`), sous `requireOrgMember`. Chacun ne lit et n'écrit que les siens.

### Le tour de piste

À la première arrivée sur `/suivi`, un dialogue présente les sept grandes fonctions (`coach-tour.tsx`, `tour-features.ts`) : suivi, calendrier et constructeur, exercices, vidéo, planificateur, progression et phases, annonces. Chaque étape porte son numéro de couloir, l'athlète de sa rubrique, ce qu'elle apporte en une phrase, et le produit tel qu'il est : une vraie capture sur données fictives (`src/features/landing/images`, `src/features/onboarding/captures`, provenance documentée et contrôlée par `tests/onboarding-captures.test.ts`), ou, pour les exercices, le vrai guide animé d'une fiche du catalogue.

- Refermable à tout moment : Échap, la croix, « Commencer » à la dernière étape, ou « Y aller ». Il ne s'ouvre seul qu'une fois (`tourSeenAt`).
- Rouvrable depuis l'aide de l'écran (« Revoir le tour de piste ») et depuis la page des premiers pas.
- Au clavier : le focus reste dans le dialogue, les flèches passent d'une étape à l'autre, une barre de sept couloirs y mène directement. En mouvement réduit, rien ne glisse.

### La carte « Pour démarrer »

Sur `/suivi` et sur `/premiers-pas` (`coach-guide.tsx`). Le tour de piste (`TrackLap`) montre la part courue, que la carte dit aussi en toutes lettres (« 2 étapes faites sur 5 »). La prochaine étape est marquée.

| Étape | Faite quand | Sur place |
| --- | --- | --- |
| Compléter ton profil | Le profil a une photo ou un avatar | Lien vers Réglages, Profil |
| Inviter tes athlètes | Une invitation existe ou un athlète a rejoint | Lien du groupe, QR code, adresses, dans la carte |
| Créer une première séance | Une séance existe | Deux modèles de départ (`/seances/nouvelle?modele=…`), une page vierge, le planificateur s'il est ouvert |
| Publier la séance | Une séance est publiée | Calendrier |
| Recevoir une première validation | Un athlète a validé | « Essaie avec ton propre téléphone » : le lien et le QR code du groupe, à ouvrir avec une autre adresse |

Étapes facultatives, sous « Pour aller plus loin », faites d'après les faits ou écartées d'un geste (« Écarter », « Reprendre ») : matériel de l'espace, première vidéo, première phase, installation de l'app (un appareil enregistré).

- Une étape avancée prouve les précédentes : une séance supprimée après une validation ne fait pas reculer la carte. Le profil se juge à part.
- « Refermer » la retire du suivi, sur tous les appareils (`dismissedAt`). Elle se retrouve dans le menu de l'engrenage et dans l'aide (« Premiers pas »), et « Remettre la carte sur le suivi » la rend.
- Un coach sans athlète ne voit plus une grille vide : la carte, et un état vide qui dit d'inviter, avec le lien.
- Un coach d'avant ce suivi garde l'ancienne règle : la carte jusqu'à sa première validation.

### La page des premiers pas

`/premiers-pas`, toujours accessible (menu de l'engrenage, aide de l'écran) : la carte entière, puis les sept fonctions avec leur état dans cet espace (athlètes, séances publiées, exercices, vidéos, planificateur ouvert ou non, phases, annonces) et un lien « Y aller » ; l'invitation sur place (`#inviter`) et l'installation (`#installer`). Le lien « Voir un espace de démonstration » y attend derrière un drapeau éteint (`DEMO_SPACE_ENABLED`, `src/lib/onboarding-paths.ts`).

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

## Ce qui se mesure

Indicateurs du pilote, dans [commercialisation.md](../plans/commercialisation.md) : activation sous 7 jours, taux et délai de validation, athlètes actifs.
