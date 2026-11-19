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
3. Création de l'espace en trois temps (`apps/web/src/features/onboarding/onboarding-form.tsx`), sur une seule action serveur :

| Temps | Contenu | Requis |
| --- | --- | --- |
| 1. À vos marques | Prénom, nom, date de naissance | Oui |
| 2. Prêts | Club ou indépendant, nom de l'espace, premier groupe, objectif du groupe | Nom et groupe |
| 3. Partez | Disciplines, objectifs et matériel ; conditions d'utilisation | Conditions |

Chaque « Continuer » valide le temps affiché et porte le focus sur le titre du suivant. Entrée fait avancer d'un temps. Une erreur dans un temps précédent y ramène, comme « Corriger » sur la confirmation de la date. L'espace naît en offre Découverte, avec la bibliothèque d'exercices, des modèles de séance (`packages/domain/src/starter-library.ts`, `starter-templates.ts`) et son premier groupe. Un compte ne possède qu'un espace gratuit.

4. Arrivée sur `/suivi`, ou sur `/abonnement` si le coach venait de `/tarifs`.
5. E-mail de bienvenue.

### Le guide « Pour démarrer »

Sur `/suivi`, jusqu'à la première validation reçue. Les étapes ne sont pas stockées : elles se déduisent de l'état réel de l'espace, par une règle pure que les e-mails d'activation liront aussi (`packages/domain/src/onboarding.ts`). Les faits viennent de `onboardingProgress`, dans `apps/web/src/server/tracking.service.ts`.

| Étape | Faite quand | Mène à |
| --- | --- | --- |
| Inviter des athlètes | Une invitation existe ou un athlète a rejoint | Réglages, Membres (`/reglages/membres#inviter`) |
| Créer une première séance | Une séance existe | Nouvelle séance |
| Publier la séance | Une séance est publiée | Calendrier |
| Recevoir une première validation | Un athlète a validé | Calendrier |

Une étape avancée prouve les précédentes : une séance supprimée après une validation ne fait pas reculer le guide. Le guide affiche le nombre d'étapes faites et marque la prochaine.

Reste à faire, hors du lot A9 : inviter et publier une première séance dès la création de l'espace, sans passer par les réglages ; refermer le guide à la main ; l'afficher en tour de piste (lot B3).

## L'athlète

1. Invitation nominative par e-mail, lien de groupe ou QR. Le coach peut renvoyer, révoquer, régénérer. Une invitation nominative sans réponse reçoit un seul rappel, trois jours plus tard.
2. `/i/[token]` : création du compte par lien ou par mot de passe, acceptation des conditions, accords santé et vidéo facultatifs et propres à la fiche. Le plafond d'athlètes de l'offre est contrôlé à ce moment.
3. E-mail de bienvenue, à la première arrivée dans l'espace.
4. Arrivée sur `/aujourdhui`.

Retirer l'accord santé efface les données de santé. Le parcours des mineurs est dormant.

### L'accueil sur `/aujourdhui`

Pendant la première semaine, et jusqu'à la première séance validée, un encart nomme le groupe et le coach qui le suit, et dit en une phrase ce qui va se passer ici (`apps/web/src/features/athlete-view/athlete-welcome.tsx`, `getAthleteWelcome` dans `athlete-view.service.ts`). Il se referme d'un geste, sur l'appareil.

- Une séance du jour passe devant : l'encart ne s'affiche pas tant qu'il y a une séance à faire.
- L'installation sur l'écran d'accueil et les notifications ne sont pas un écran de plus : l'encart déclenche tout de suite le bandeau existant (`install-banner.tsx`), qui attendait jusque-là une première action utile. Les notifications se demandent toujours par un bouton, jamais à l'ouverture.

### La proposition de mot de passe

L'athlète entré par un lien, sans mot de passe ni connexion Google ou Apple, voit sur `/aujourdhui` une carte « Un mot de passe pour revenir plus vite » (`apps/web/src/features/auth/password-prompt.tsx`).

- Elle vient après la séance du jour, jamais avant, et n'est ni un dialogue ni une étape : rien ne retarde la validation.
- « Définir un mot de passe » ouvre le champ dans la carte quand la connexion est récente ; sinon le bouton mène à Réglages, Connexion, où la confirmation par e-mail prend le relais.
- « Non merci » la referme pour de bon. L'état est gardé sur le compte (`profiles.password_prompt_dismissed_at`) : elle ne revient sur aucun appareil. Le réglage reste disponible dans Réglages, Connexion.

## Ce qui se mesure

Indicateurs du pilote, dans [commercialisation.md](../plans/commercialisation.md) : activation sous 7 jours, taux et délai de validation, athlètes actifs.
