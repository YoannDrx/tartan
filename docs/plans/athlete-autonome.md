# Athlète autonome : plan

Décision du fondateur, 23 novembre 2026. Un athlète peut s'inscrire sur Tartan sans coach, planifier et valider ses propres séances, puis rejoindre un jour le groupe d'un coach en partageant, s'il le veut, son historique. Gratuit, avec de petits quotas d'IA et de vidéo.

## 1. Constat (analyse du 23 novembre)

- Un compte se crée toujours, même inscriptions fermées : lien magique sans `disableSignUp` (`apps/web/src/lib/auth.ts`), bouton « Je n'ai pas encore de compte » toujours visible sur l'app native.
- Sans espace, le web mène à `/bienvenue` : « Crée ton espace coach », ou « Tartan ouvre bientôt aux coachs » si les inscriptions sont fermées. Aucun choix « je suis athlète », aucune déconnexion, aucun accès aux réglages ni à la suppression du compte.
- L'app native mène à `/onboarding` (« Tu coaches »), sans accès à la suppression du compte ; elle ignore le réglage d'ouverture et ne voit le refus qu'au dernier envoi ; `POST /api/v1/orgs` n'enregistre pas les conditions.
- Un athlète qui crée un espace coach « pour essayer » reçoit les e-mails du coach, consomme son unique espace Découverte et ne peut pas valider de séance pour lui-même (validation réservée au rôle athlète, planification réservée aux encadrants).
- Un compte sans espace ne reçoit aucun e-mail d'accueil.
- Invitation d'un compte existant : l'e-mail `account_exists` renvoie vers `/connexion` sans revenir à l'invitation ; une invitation nominative à une autre adresse n'est refusée qu'à l'envoi, sans moyen de changer de compte ; `acceptInvitation` réécrit le nom du compte pour tous ses espaces.
- Toutes les données d'entraînement et de santé sont rattachées à un espace ; aucun espace personnel ni offre individuelle n'existe ; les textes juridiques supposent un coach.

## 2. Décisions

| Sujet | Décision |
| --- | --- |
| Athlète sans invitation | Parcours autonome complet, dans un **espace personnel** |
| Rejoindre un coach | Il garde son espace personnel ; il **partage s'il le veut** son historique avec le coach, en lecture seule, révocable ; aucune donnée de santé sans un accord explicite à part |
| Prix | **Gratuit**, avec de petits quotas mensuels : 5 propositions du planificateur IA, 10 minutes de dictée, 4 vidéos ; aucun prix sur iOS et Android |

## 3. Modèle

- **Espace personnel** : colonnes additives `organizations.kind` (`coach` par défaut, `personal`) et `personal_owner_id` (unique : un seul espace personnel par compte), sur le modèle de l'espace de démonstration (`isDemo`, `demoOwnerId`, `REAL_SPACES`, `assertNotDemoSpace`).
- **Membre unique** : le titulaire est membre `athlete` de son espace personnel, avec une fiche d'athlète liée à son compte (`userId`). Aucun autre membre possible : `requireOrgMember` refuse tout autre compte, `createInvitation` et ses variantes refusent l'espace personnel.
- **Droits** : dans un espace personnel, l'athlète titulaire reçoit en plus les droits de planification **pour sa seule fiche** (créer, publier, modifier, dupliquer ses séances et modèles ; ses tests de force, références, performances, phases ; sa bibliothèque et ses listes). Règle pure dans `packages/domain/src/permissions.ts` (`personal`), lignes dans la matrice d'accès, tests qui prouvent qu'aucun droit n'en déborde.
- **Offre** : `personal` dans `packages/domain/src/plans.ts` (1 athlète, aucun groupe à gérer, quotas ci-dessus), jamais facturée ; exclue de la facturation, des plafonds d'espace et des statistiques de revenus.
- **Partage avec un coach** : table additive `history_shares` (espace personnel, espace du coach, fiche dans l'espace du coach, périmètre `records | strength | sessions`, `granted_at`, `revoked_at`). Lecture par un service du coach sous `requireOrgMember` et contrôle du partage ; jamais de copie ; révocable à tout moment.

## 4. Parcours

### Inscription et aiguillage (web et natif)
1. `/bienvenue` (et l'aiguillage natif) propose trois choix de même rang : **« Je suis coach »** (parcours actuel), **« Je m'entraîne seul »** (espace personnel), **« J'ai un lien d'invitation »** (champ pour coller le lien ou le code). Plus : se déconnecter, et accès à la suppression du compte.
2. Le réglage `/admin/configuration` gagne « Inscriptions des athlètes autonomes » (fermées par défaut, `ATHLETE_SIGNUP_MODE`, ouvertes par le fondateur depuis la console), à côté de celui des coachs ; l'app native lit les deux et n'affiche que les choix permis.
3. Parcours « Je m'entraîne seul » : prénom, nom, date de naissance (adultes seulement, comme aujourd'hui), disciplines et objectifs, conditions ; création de l'espace personnel, puis l'accueil.

### Accueil de l'athlète autonome
- Premiers pas propres : planifier une séance (modèle, vierge ou planificateur IA), la valider, noter une référence de force ou un record, installer l'app. Même mécanique que le coach (`OnboardingState`, carte, page `/premiers-pas`), contenu d'athlète.
- Navigation : Aujourd'hui, Calendrier, Exercices, Progrès, Vidéos ; « Planifier » ouvre le constructeur sans destinataires (la cible est toujours lui-même). Pas de Suivi de groupe, d'Athlètes, d'Annonces, de Membres, d'Abonnement.

### Rejoindre un coach
- Depuis un lien d'invitation, connecté ou non. Avant d'accepter : l'adresse visée par une invitation nominative est montrée, avec « Changer de compte » ; l'e-mail `account_exists` ramène à l'invitation.
- À l'acceptation : il devient athlète de l'espace du coach (fiche propre à cet espace) et garde son espace personnel ; le nom du compte n'est plus réécrit s'il est déjà renseigné.
- Écran suivant, facultatif : « Partager mon historique avec <coach> » par cases (records, références de force, historique des séances) ; santé exclue. Révocable dans Réglages, rubrique Confidentialité. Le coach voit une section « Historique personnel partagé » sur la fiche de l'athlète.
- La journée et le calendrier réunissent les séances du club et du carnet. Les vraies appartenances à plusieurs clubs se retrouvent dans Réglages, Mes clubs.

### Comptes sans espace (filet)
- E-mail « Termine ton inscription » 24 h après la création d'un compte sans espace ni invitation, puis rien.

## 5. E-mails

| E-mail | Pour | Quand |
| --- | --- | --- |
| `personal_welcome` (nouveau) | Athlète autonome | À la création de l'espace personnel |
| `personal_activation` (nouveau, J1, J3, J7) | Athlète autonome | Prochaine étape manquante de ses premiers pas, coupée par `emailTips` |
| `finish_signup` (nouveau) | Compte sans espace | 24 h après la création, une fois |
| `history_shared` (nouveau) | Coach | Quand un athlète partage son historique |
| `welcome`, `activation`, `weekly_digest`, `plan_near_limit` | Coach seulement | Exclus pour un espace personnel |

## 6. Juridique

CGU, politique de confidentialité et CGV : l'athlète autonome est responsable de ses données ; personne d'autre ne voit son espace personnel ; partage avec un coach par cases et révocable ; données de santé jamais partagées sans accord explicite ; conservation et suppression. Textes dans `packages/i18n`. Relecture juridique par le fondateur (engagement légal).

## 7. Lots

| Lot | Contenu |
| --- | --- |
| AA1 Socle web | Correctifs des impasses (déconnexion, suppression, invitation, nom, conditions de `POST /orgs`), espace personnel (données, droits, offre, exclusions), aiguillage `/bienvenue`, parcours « Je m'entraîne seul », navigation et constructeur sans destinataires, premiers pas, quotas, e-mails, réglage d'ouverture, textes juridiques |
| AA2 Partage | `history_shares`, écran de partage après l'invitation, révocation, section du coach, e-mail |
| AA3 App native | Aiguillage, parcours autonome, navigation, constructeur sans destinataires, partage, suppression du compte sans espace ; flux Maestro |

## 8. Vérification

- Tests de service et de domaine : droits de l'espace personnel (aucun débordement vers un autre espace, aucun second membre), exclusions (facturation, e-mails du coach, statistiques), quotas, partage (lecture seule, révocation, santé exclue), invitation d'un compte autonome.
- Parcours Playwright sur build de production : athlète autonome de l'inscription à sa première séance validée ; même athlète invité par un coach, partage puis révocation ; compte sans espace qui se déconnecte et supprime son compte ; matrice des écrans.
- Maestro : les mêmes parcours sur iOS et Android.
- Essai réel par le fondateur avec une troisième adresse, sur la Preview puis en production.
