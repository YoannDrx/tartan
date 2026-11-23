# E-mails

Tous les e-mails que Tartan envoie, leur déclencheur et la façon de s'en désinscrire. La source est le catalogue `apps/web/emails/catalog.tsx` : un e-mail absent de cette page n'existe pas. Le niveau de preuve (rendu testé, reçu en boîte réelle) est dans [../ETAT.md](../ETAT.md).

## Fonctionnement

| Élément                                 | Où                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Gabarit commun, bandeau et pied de page | `apps/web/emails/layout.tsx`                                                                                                               |
| Gabarits                                | `apps/web/emails/auth.tsx`, `credentials.tsx` (mot de passe), `billing.tsx`, `digest.tsx`                                                  |
| Textes                                  | `packages/i18n/src/fr.ts`, sous `m.email` et `m.billing` ; ceux du mot de passe dans `packages/i18n/src/web/auth.ts`, sous `w.auth.emails` |
| Envoi                                   | `apps/web/src/lib/mail.tsx`                                                                                                                |
| File avec nouvelles tentatives          | `apps/web/src/server/email-outbox.service.ts`, vidée toutes les 15 minutes par `/api/cron/notifications`                                   |
| Transitions de facturation              | `packages/domain/src/billing-emails.ts`                                                                                                    |
| Registre et catégories                  | `apps/web/src/server/email-registry.ts`                                                                                                    |
| Liste de blocage, rebonds et plaintes   | `email-suppression.service.ts`, webhook `/api/webhooks/resend`                                                                             |
| Préférences et désinscription           | `email-preferences.service.ts`, page `/e-mails/[kind]/[token]`                                                                             |
| Envois d'essai                          | `/admin/configuration` → E-mails de test                                                                                                   |

Un incident de paiement ne donne qu'un e-mail : « paiement échoué » et « validation demandée » ne se cumulent pas dans la même heure. Sans clé Resend, les messages restent en mémoire, sauf en production où l'envoi échoue. Les adresses `@demo.tartan.coach` ne reçoivent rien. Un e-mail ne contient jamais de donnée de santé, ni de mot de passe.

Pour les parcours Playwright, le serveur dépose en plus chaque message (destinataire, objet, lien d'action) dans le dossier `E2E_MAIL_DIR`, que le test relit pour suivre le vrai lien (`apps/web/e2e/mail.ts`). Cette variable est refusée en production par `assertEnvIsolation`, et la branche qui la lit ne s'exécute que sans clé Resend.

## Les 36 e-mails en place

| Clé du catalogue          | Destinataire                                                      | Déclencheur                                                                                                                 | Envoi                       | Désinscription         |
| ------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------- |
| `verify`                  | Nouveau compte                                                    | Inscription, connexion d'une adresse non vérifiée                                                                           | Direct                      | Non                    |
| `magic_link`              | Compte                                                            | Demande de lien de connexion                                                                                                | Direct                      | Non                    |
| `reset_password`          | Compte                                                            | Mot de passe oublié                                                                                                         | Direct                      | Non                    |
| `password_changed`        | Compte                                                            | Mot de passe réinitialisé par « mot de passe oublié », ou changé dans Réglages, Connexion                                   | Direct                      | Non                    |
| `password_set`            | Compte                                                            | Mot de passe défini sur un compte qui n'en avait pas (accueil de l'athlète ou Réglages, Connexion)                          | Direct                      | Non                    |
| `password_setup_confirm`  | Compte                                                            | Demande de mot de passe depuis une session de plus d'une heure : le lien prouve la boîte mail et rouvre une session récente | Direct                      | Non                    |
| `account_exists`          | Compte existant                                                   | Création de compte par mot de passe demandée sur une adresse déjà inscrite                                                  | Direct                      | Non                    |
| `invitation_athlete`      | Athlète invité                                                    | Invitation nominative par le coach, ou renvoi                                                                               | File, tentative immédiate   | Non                    |
| `invitation_staff`        | Coach invité                                                      | Invitation dans un espace, ou renvoi                                                                                        | File, tentative immédiate   | Non                    |
| `invitation_reminder`     | Athlète invité                                                    | Invitation nominative sans réponse depuis trois à cinq jours, une seule fois                                                | File, tâche de 9 h          | Oui, par adresse       |
| `athlete_welcome`         | Athlète                                                           | Première arrivée dans un espace, à l'acceptation de l'invitation                                                            | File, tentative immédiate   | Non                    |
| `parental_consent`        | Parent                                                            | Parcours parental, dormant (`PARENTAL_FLOW_ENABLED`)                                                                        | Direct                      | Non                    |
| `welcome`                 | Propriétaire                                                      | Création de son premier espace                                                                                              | Direct                      | Non                    |
| `weekly_digest`           | Coach                                                             | Dimanche à 18 h                                                                                                             | Tâche horaire               | Oui, « résumé »        |
| `notification_fallback`   | Membre                                                            | Notification non livrée en push                                                                                             | Livraison des notifications | Oui, « notifications » |
| `content_report`          | Responsable de l'espace et éditeur                                | Contenu signalé                                                                                                             | Direct                      | Non                    |
| `founder_alert`           | Fondateur                                                         | Impayé, litige, remboursement en échec                                                                                      | Direct                      | Non                    |
| `inactivity`              | Compte                                                            | Préavis avant suppression pour inactivité                                                                                   | Tâche horaire               | Non                    |
| `workspace_inactivity`    | Propriétaire                                                      | Préavis avant suppression de l'espace                                                                                       | Tâche horaire               | Non                    |
| `video_purge`             | Propriétaire                                                      | Préavis avant retrait des vidéos hors durée de l'offre                                                                      | Tâche horaire               | Non                    |
| `subscription_started`    | Propriétaire                                                      | Abonnement démarré                                                                                                          | File                        | Non                    |
| `subscription_cancelled`  | Propriétaire                                                      | Résiliation programmée                                                                                                      | File                        | Non                    |
| `subscription_ended`      | Propriétaire                                                      | Abonnement terminé, impayé ou non                                                                                           | File                        | Non                    |
| `payment_failed`          | Propriétaire                                                      | Prélèvement échoué                                                                                                          | File                        | Non                    |
| `payment_action_required` | Propriétaire                                                      | La banque demande une validation (`invoice.payment_action_required`), tant que la facture reste ouverte                     | File                        | Non                    |
| `payment_recovered`       | Propriétaire                                                      | Paiement rétabli                                                                                                            | File                        | Non                    |
| `trial_ending`            | Propriétaire                                                      | Trois jours avant la fin de l'essai                                                                                         | File, tâche de 9 h          | Non                    |
| `renewal_notice`          | Propriétaire                                                      | Avant le renouvellement annuel (art. L. 215-1)                                                                              | File                        | Non                    |
| `activation`              | Propriétaire                                                      | Un, trois et sept jours après la création de l'espace, sur la prochaine étape manquante des premiers pas                    | File, tâche de 9 h          | Oui, « conseils »      |
| `plan_near_limit`         | Propriétaire                                                      | Athlètes ou vidéos du mois à 80 % de la limite de l'offre                                                                   | File, tâche de 9 h          | Non                    |
| `account_deleted`         | Ancien compte                                                     | Compte supprimé                                                                                                             | File                        | Non                    |
| `space_transferred`       | Nouveau propriétaire                                              | Espace transmis                                                                                                             | File                        | Non                    |
| `personal_welcome`        | Athlète autonome                                                  | Ouverture de son espace personnel, mise en file dans la même transaction                                                    | File, tentative immédiate   | Non                    |
| `personal_activation`     | Athlète autonome                                                  | Un, trois et sept jours après l'ouverture de son espace, sur la prochaine étape manquante de ses premiers pas               | File, tâche de 9 h          | Oui, « conseils »      |
| `finish_signup`           | Compte sans espace                                                | Compte confirmé, sans espace ni invitation ouverte, 24 à 72 heures après sa création, une seule fois                        | File, tâche horaire         | Non                    |
| `history_shared`          | Coachs qui suivent la fiche (propriétaire, coachs de ses groupes) | Un athlète ouvre ou élargit le partage de son historique personnel ; ni chiffre ni santé dans le message                    | Direct                      | Non                    |

## Règles d'envoi

- **Registre.** `apps/web/src/server/email-registry.ts` liste chaque e-mail avec sa catégorie : sécurité, invitation, facturation, compte, activité, interne. `sendEmail` exige la clé du registre. Deux tests échouent si le catalogue d'essai ou cette page oublient un e-mail.
- **Liste de blocage.** Un rebond définitif bloque tout, et l'emporte sur une plainte déjà notée. Une plainte ou une désinscription bloque tout sauf la catégorie sécurité : personne ne perd l'accès à son compte pour avoir signalé un résumé.
- **Adresse qui rebondit à la connexion.** Le formulaire le dit (« Cette adresse ne reçoit plus nos e-mails »). La demande de réinitialisation, elle, répond toujours la même chose, pour ne pas révéler qu'un compte existe.
- **Liens de connexion.** Envoyés en direct, jamais par la file : un lien valide ne s'écrit pas dans une table.
- **Mot de passe.** Chaque définition et chaque changement prévient le compte (`password_set`, `password_changed`), avec un lien pour en choisir un autre. Une alerte qui échoue n'annule pas le mot de passe enregistré. `password_setup_confirm` porte un lien de connexion ordinaire (une fois, 15 minutes) sous un autre texte. `account_exists` ne porte aucun lien de connexion : il renvoie à `/connexion`, et dit que le mot de passe saisi n'a pas été enregistré. Quand l'inscription partait d'une invitation (en-tête `x-tartan-return` posé par le formulaire de `/i/[token]`, ou à défaut une invitation nominative encore ouverte à cette adresse), le lien est `/connexion?next=/i/…` : la connexion rouvre l'invitation. L'écran, lui, répond comme pour une adresse neuve.
- **Invitations.** Elles passent par la file, qui ne garde que l'identifiant de l'invitation ; le lien est dérivé au rendu. L'envoi est tenté tout de suite, puis repris pendant 24 heures. Une invitation acceptée, révoquée ou expirée entre-temps ne part plus. Limite : si l'adresse est en liste de blocage, le coach n'en est pas averti à l'écran.
- **Genre inconnu.** Une ligne de la file dont le genre n'est pas au registre est marquée en échec `unknown_kind` et signalée, au lieu de partir sous un autre gabarit.
- **Objets.** Dans `packages/i18n`, sous `m.email` ; le catalogue lit les mêmes.

## Séquence d'activation

Trois rappels au plus, décidés par une règle pure (`packages/domain/src/lifecycle-emails.ts`) à partir des faits des premiers pas (`packages/domain/src/onboarding.ts`). Ce sont les mêmes faits, lus par la même fonction (`readCoachFacts`, `apps/web/src/server/onboarding.service.ts`), que la carte « Pour démarrer » ; les liens sont les mêmes que ceux de la carte (`apps/web/src/lib/onboarding-paths.ts`). Service : `apps/web/src/server/lifecycle-email.service.ts`.

| Échéance | Fenêtre depuis la création | Contenu                                                                                              |
| -------- | -------------------------- | ---------------------------------------------------------------------------------------------------- |
| J+1      | De 1 à 2 jours             | La prochaine étape manquante de la carte, dans son ordre : inviter, créer, publier, ou faire valider |
| J+3      | De 3 à 5 jours             | Idem                                                                                                 |
| J+7      | De 7 à 10 jours            | Idem, avec une invitation à répondre pour être aidé                                                  |

| Étape         | Lien de l'e-mail                                                                        |
| ------------- | --------------------------------------------------------------------------------------- |
| Inviter       | `/premiers-pas#inviter` : le lien du groupe, le QR code et quelques adresses, sur place |
| Créer         | `/seances/nouvelle`                                                                     |
| Publier       | `/calendrier`                                                                           |
| Faire valider | `/suivi`                                                                                |

- La photo du profil est une étape de la carte, mais elle ne vaut pas un e-mail (`coachActivationStep`) : les rappels visent la première validation.

- Un message est mis en file le matin où il est dû, jamais à l'avance : la file expire tout message de plus de 24 heures.
- Passé la fenêtre, rien ne part : après une panne de la tâche, un rappel en retard n'aurait plus de sens.
- La pertinence est revérifiée à l'envoi : le coach qui vient de faire l'étape, ou qui a coupé les conseils, ne reçoit rien.
- Un coach qui a reçu sa première validation ne reçoit plus rien.
- Il n'y a pas d'e-mail distinct pour un essai sans activation : la séquence le couvre déjà, et le rappel de fin d'essai suit.

## Athlète autonome

Service : `apps/web/src/server/personal-email.ts`. Règles pures : `personalActivationEmailFor` et `finishSignupDue` (`packages/domain/src/lifecycle-emails.ts`). Textes : `w.personal.emails` (`packages/i18n/src/web/personal.ts`), gabarits dans `apps/web/emails/personal.tsx`.

- **Exclusions.** Un espace personnel ne reçoit aucun e-mail du coach : ni `welcome`, ni `activation`, ni `weekly_digest`, ni `plan_near_limit`. Les requêtes de ces tâches ne lisent que les espaces de coach (`COACH_SPACES`, `demo-space-guard.ts`).
- **Bienvenue.** Une seule fois par compte (clé `personal_welcome:<compte>`), revérifiée à l'envoi : l'espace existe toujours et appartient à ce compte.
- **Conseils.** Mêmes fenêtres que ceux du coach (J+1, J+3, J+7). L'étape suit la carte de ses premiers pas : planifier une séance, la valider, noter une référence de force. L'installation ne vaut pas un e-mail. Coupés par `emailTips`, comme ceux du coach.
- **Termine ton inscription.** Un compte confirmé, sans aucun espace ni invitation nominative ouverte à son adresse, reçoit un seul message entre 24 et 72 heures après sa création (clé `finish_signup:<compte>`), qui mène à l'aiguillage de `/bienvenue`. Un espace rejoint ou ouvert entre-temps l'annule.

## Plafond presque atteint

Le matin, le payeur est prévenu quand les athlètes ou les vidéos du mois atteignent 80 % de la limite de son offre, sans l'avoir atteinte. Une fois par limite d'athlètes, une fois par mois pour les vidéos. Les offres sans limite et les limites inférieures à cinq ne préviennent pas.

## Arrivée de l'athlète

Service : `apps/web/src/server/athlete-email.ts`.

- **Bienvenue.** Mise en file dans la transaction qui accepte l'invitation, pour une première arrivée seulement : rouvrir un lien de groupe ne la renvoie pas. Elle nomme le groupe et le coach, et rappelle d'installer l'application et d'activer les notifications.
- **Rappel d'invitation.** Un seul par invitation nominative d'athlète, quand elle reste sans réponse trois à cinq jours après la dernière action dessus : un renvoi par le coach repousse donc le rappel. Il ne part pas si l'invitation a été acceptée, révoquée ou a expiré entre-temps.
- **Opposition par adresse.** La personne invitée n'a pas de compte : le lien du rappel et son en-tête `List-Unsubscribe` portent un jeton tiré de l'invitation. L'adresse rejoint alors la liste de blocage : plus d'invitation ni de rappel, les e-mails de connexion restent. Limite : le coach qui réinvite cette adresse n'en est pas averti.

## Non construit

L'e-mail de reconquête, trente jours après une fin d'abonnement : c'est de la prospection, il attend l'avis du juriste.

## Préférences

Trois interrupteurs sur le profil, réglables dans Réglages, Notifications (`/reglages/notifications`), et par une désinscription en un clic (en-tête `List-Unsubscribe`, page `/e-mails/[kind]/[token]`, qui sert aussi à l'opposition d'une personne invitée) : `emailDigest` (résumé), `emailNotifications` (replis de notification), `emailTips` (conseils d'activation). Ne se désactivent pas : sécurité du compte, facturation, invitations, préavis de suppression.
