# E-mails

Tous les e-mails que Tartan envoie, leur déclencheur et la façon de s'en désinscrire. La source est le catalogue `apps/web/emails/catalog.tsx` : un e-mail absent de cette page n'existe pas. Le niveau de preuve (rendu testé, reçu en boîte réelle) est dans [../ETAT.md](../ETAT.md).

## Fonctionnement

| Élément | Où |
| --- | --- |
| Gabarit commun, bandeau et pied de page | `apps/web/emails/layout.tsx` |
| Gabarits | `apps/web/emails/auth.tsx`, `billing.tsx`, `digest.tsx` |
| Textes | `packages/i18n/src/fr.ts`, sous `m.email` et `m.billing` |
| Envoi | `apps/web/src/lib/mail.tsx` |
| File avec nouvelles tentatives | `apps/web/src/server/email-outbox.service.ts`, vidée toutes les 15 minutes par `/api/cron/notifications` |
| Transitions de facturation | `packages/domain/src/billing-emails.ts` |
| Registre et catégories | `apps/web/src/server/email-registry.ts` |
| Liste de blocage, rebonds et plaintes | `email-suppression.service.ts`, webhook `/api/webhooks/resend` |
| Préférences et désinscription | `email-preferences.service.ts`, page `/e-mails/[kind]/[token]` |
| Envois d'essai | `/admin/configuration` → E-mails de test |

Un incident de paiement ne donne qu'un e-mail : « paiement échoué » et « validation demandée » ne se cumulent pas dans la même heure. Sans clé Resend, les messages restent en mémoire, sauf en production où l'envoi échoue. Les adresses `@demo.tartan.coach` ne reçoivent rien. Un e-mail ne contient jamais de donnée de santé.

## Les 27 e-mails en place

| Clé du catalogue | Destinataire | Déclencheur | Envoi | Désinscription |
| --- | --- | --- | --- | --- |
| `verify` | Nouveau compte | Inscription, connexion d'une adresse non vérifiée | Direct | Non |
| `magic_link` | Compte | Demande de lien de connexion | Direct | Non |
| `reset_password` | Compte | Mot de passe oublié | Direct | Non |
| `password_changed` | Compte | Mot de passe modifié | Direct | Non |
| `invitation_athlete` | Athlète invité | Invitation nominative par le coach, ou renvoi | File, tentative immédiate | Non |
| `invitation_staff` | Coach invité | Invitation dans un espace, ou renvoi | File, tentative immédiate | Non |
| `parental_consent` | Parent | Parcours parental, dormant (`PARENTAL_FLOW_ENABLED`) | Direct | Non |
| `welcome` | Propriétaire | Création de son premier espace | Direct | Non |
| `weekly_digest` | Coach | Dimanche à 18 h | Tâche horaire | Oui, « résumé » |
| `notification_fallback` | Membre | Notification non livrée en push | Livraison des notifications | Oui, « notifications » |
| `content_report` | Responsable de l'espace et éditeur | Contenu signalé | Direct | Non |
| `founder_alert` | Fondateur | Impayé, litige, remboursement en échec | Direct | Non |
| `inactivity` | Compte | Préavis avant suppression pour inactivité | Tâche horaire | Non |
| `workspace_inactivity` | Propriétaire | Préavis avant suppression de l'espace | Tâche horaire | Non |
| `video_purge` | Propriétaire | Préavis avant retrait des vidéos hors durée de l'offre | Tâche horaire | Non |
| `subscription_started` | Propriétaire | Abonnement démarré | File | Non |
| `subscription_cancelled` | Propriétaire | Résiliation programmée | File | Non |
| `subscription_ended` | Propriétaire | Abonnement terminé, impayé ou non | File | Non |
| `payment_failed` | Propriétaire | Prélèvement échoué | File | Non |
| `payment_action_required` | Propriétaire | La banque demande une validation (`invoice.payment_action_required`), tant que la facture reste ouverte | File | Non |
| `payment_recovered` | Propriétaire | Paiement rétabli | File | Non |
| `trial_ending` | Propriétaire | Trois jours avant la fin de l'essai | File, tâche de 9 h | Non |
| `renewal_notice` | Propriétaire | Avant le renouvellement annuel (art. L. 215-1) | File | Non |
| `activation` | Propriétaire | Un, trois et sept jours après la création de l'espace, sur la prochaine étape manquante des premiers pas | File, tâche de 9 h | Oui, « conseils » |
| `plan_near_limit` | Propriétaire | Athlètes ou vidéos du mois à 80 % de la limite de l'offre | File, tâche de 9 h | Non |
| `account_deleted` | Ancien compte | Compte supprimé | File | Non |
| `space_transferred` | Nouveau propriétaire | Espace transmis | File | Non |

## Règles d'envoi

- **Registre.** `apps/web/src/server/email-registry.ts` liste chaque e-mail avec sa catégorie : sécurité, invitation, facturation, compte, activité, interne. `sendEmail` exige la clé du registre. Deux tests échouent si le catalogue d'essai ou cette page oublient un e-mail.
- **Liste de blocage.** Un rebond définitif bloque tout, et l'emporte sur une plainte déjà notée. Une plainte ou une désinscription bloque tout sauf la catégorie sécurité : personne ne perd l'accès à son compte pour avoir signalé un résumé.
- **Adresse qui rebondit à la connexion.** Le formulaire le dit (« Cette adresse ne reçoit plus nos e-mails »). La demande de réinitialisation, elle, répond toujours la même chose, pour ne pas révéler qu'un compte existe.
- **Liens de connexion.** Envoyés en direct, jamais par la file : un lien valide ne s'écrit pas dans une table.
- **Invitations.** Elles passent par la file, qui ne garde que l'identifiant de l'invitation ; le lien est dérivé au rendu. L'envoi est tenté tout de suite, puis repris pendant 24 heures. Une invitation acceptée, révoquée ou expirée entre-temps ne part plus. Limite : si l'adresse est en liste de blocage, le coach n'en est pas averti à l'écran.
- **Genre inconnu.** Une ligne de la file dont le genre n'est pas au registre est marquée en échec `unknown_kind` et signalée, au lieu de partir sous un autre gabarit.
- **Objets.** Dans `packages/i18n`, sous `m.email` ; le catalogue lit les mêmes.

## Séquence d'activation

Trois rappels au plus, décidés par une règle pure (`packages/domain/src/lifecycle-emails.ts`) à partir des faits des premiers pas (`packages/domain/src/onboarding.ts`). Service : `apps/web/src/server/lifecycle-email.service.ts`.

| Échéance | Fenêtre depuis la création | Contenu |
| --- | --- | --- |
| J+1 | De 1 à 2 jours | La prochaine étape manquante : inviter, créer, publier, ou faire valider |
| J+3 | De 3 à 5 jours | Idem |
| J+7 | De 7 à 10 jours | Idem, avec une invitation à répondre pour être aidé |

- Un message est mis en file le matin où il est dû, jamais à l'avance : la file expire tout message de plus de 24 heures.
- Passé la fenêtre, rien ne part : après une panne de la tâche, un rappel en retard n'aurait plus de sens.
- La pertinence est revérifiée à l'envoi : le coach qui vient de faire l'étape, ou qui a coupé les conseils, ne reçoit rien.
- Un coach qui a reçu sa première validation ne reçoit plus rien.
- Il n'y a pas d'e-mail distinct pour un essai sans activation : la séquence le couvre déjà, et le rappel de fin d'essai suit.

## Plafond presque atteint

Le matin, le payeur est prévenu quand les athlètes ou les vidéos du mois atteignent 80 % de la limite de son offre, sans l'avoir atteinte. Une fois par limite d'athlètes, une fois par mois pour les vidéos. Les offres sans limite et les limites inférieures à cinq ne préviennent pas.

## Ajouts prévus

Lot A11 de [web.md](../plans/web.md).

| E-mail | Destinataire | Déclencheur | Désinscription |
| --- | --- | --- | --- |
| Bienvenue de l'athlète | Athlète | Invitation acceptée | Non |
| Relance d'invitation | Athlète invité | Invitation sans réponse à J+3, une seule fois, signée du coach | Opposition par adresse |

Non construit, en attente de l'avis du juriste : l'e-mail de reconquête, trente jours après une fin d'abonnement. C'est de la prospection.

## Préférences

Trois interrupteurs sur le profil, réglables dans Réglages et par une désinscription en un clic (en-tête `List-Unsubscribe`, page `/e-mails/[kind]/[token]`) : `emailDigest` (résumé), `emailNotifications` (replis de notification), `emailTips` (conseils d'activation). Ne se désactivent pas : sécurité du compte, facturation, invitations, préavis de suppression.
