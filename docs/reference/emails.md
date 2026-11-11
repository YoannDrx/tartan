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

## Les 25 e-mails en place

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

## Ajouts prévus

Décidés le 11 novembre 2026, lots A10 et A11 de [web.md](../plans/web.md). Chacun a son gabarit, ses textes, son entrée au registre, un test de rendu et un test de déclencheur.

| E-mail | Destinataire | Déclencheur | Désinscription |
| --- | --- | --- | --- |
| Activation, J+1, J+3, J+7 | Propriétaire | Prochaine étape manquante : inviter, créer, publier, première validation | Oui, « conseils » |
| Essai sans activation | Propriétaire | Essai en cours, aucun athlète ni séance | Oui, « conseils » |
| Plafond presque atteint | Propriétaire | Athlètes ou vidéos du mois proches de la limite de l'offre | Non |
| Bienvenue de l'athlète | Athlète | Invitation acceptée | Non |
| Relance d'invitation | Athlète invité | Invitation sans réponse à J+3, une seule fois, signée du coach | Opposition par adresse |
| Reconquête | Ancien abonné | Trente jours après une fin d'abonnement non impayée, une seule fois | Oui, « offres » |

Règles de ces séquences :

- La décision d'envoyer est une fonction pure de `packages/domain/src/lifecycle-emails.ts`, sur le modèle de `billing-emails.ts`.
- Un message est mis en file le jour où il est dû, jamais à l'avance : la file expire tout message de plus de 24 heures.
- Chaque échéance a une fenêtre : J+1 entre un et deux jours, J+3 entre trois et cinq, J+7 entre sept et dix. Après une panne, rien ne part en retard.
- La pertinence est revérifiée à l'envoi : pas de relance « invite ton groupe » à un coach qui vient d'inviter.
- L'e-mail de reconquête est de la prospection : il attend l'avis du juriste.

## Préférences

Aujourd'hui : deux interrupteurs sur le profil, `emailDigest` et `emailNotifications`, et une désinscription en un clic par en-tête `List-Unsubscribe`. Le lot A10 ajoute « conseils » et « offres ». Ne se désactivent pas : sécurité du compte, facturation, invitations, bienvenue de l'athlète, préavis de suppression.
