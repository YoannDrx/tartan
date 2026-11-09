# Fiches stores et formulaires de confidentialité

Base : ce que l'app collecte réellement, relevé dans le code le 9 novembre 2026. À relire par toi et le juriste avant envoi. Règles vérifiées sur les pages officielles d'Apple et de Google à cette date.

## Fiche commune

| Élément                   | Texte                                                                                            | Limite                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Nom                       | Tartan – Préparation physique                                                                             | 30 (Apple, Google), 29 utilisés                                                                             |
| Sous-titre Apple          | Séances, suivi et vidéo                                                                          | 30, 23 utilisés. La formule du § 4.4 (« Séances, suivi et vidéo pour ton groupe ») en fait 39 : trop longue |
| Mots-clés Apple           | `préparation physique,athlétisme,coach,entraînement,pliométrie,musculation,analyse vidéo` | 100, 87 utilisés |
| Catégorie                 | Sport (secondaire : Forme et santé)                                                              |                                                                                                             |
| Description courte Google | Le carnet du coach d'athlé et de son groupe : séances, suivi et analyse vidéo.                   | 80                                                                                                          |

La description longue est dans « Textes prêts à coller », plus bas.

### Adresses

| Élément                                       | Adresse                                 |
| --------------------------------------------- | --------------------------------------- |
| Confidentialité                               | https://tartan.coach/mobile/confidentialite |
| Conditions                                    | https://tartan.coach/mobile/conditions  |
| Assistance                                    | https://tartan.coach/mobile/contact     |
| Suppression de compte (web, exigé par Google) | https://tartan.coach/suppression-compte |

### Compte de démonstration

Comptes dédiés à la revue, créés par toi sur la production, avec `DEMO_PASSWORD` : un coach et un athlète, tous deux fictifs et majeurs, avec des données fictives. Procédure :

1. Avec les variables de production chargées (`VERCEL_ENV=production`), `pnpm --filter @tartan/web db:seed`. Il ne touche à aucun compte réel : il n'écrit que des adresses `@demo.tartan.coach`, et aucun mail n'y part.
2. Se connecter avec chaque compte depuis l'app, vérifier qu'il n'y a ni écran d'âge ni donnée réelle.
3. Après la revue, retirer les comptes : `pnpm --filter @tartan/web demo:fill <e-mail> --retirer` ou leur suppression depuis les réglages.

Jamais de vraie donnée sur ces comptes. La bibliothèque de démonstration n'affiche pas les reels non autorisés (décision D12, à faire par le fondateur dans la bibliothèque commune).

## Formulaire Apple « App Privacy »

Aucun suivi publicitaire (« Tracking : non »). Toutes les données sont liées à l'identité de l'utilisateur et servent au fonctionnement de l'app.

| Catégorie Apple                        | Données réelles                                                     | Finalité déclarée |
| -------------------------------------- | ------------------------------------------------------------------- | ----------------- |
| Coordonnées : nom                      | Prénom, nom                                                         | Fonctionnement    |
| Coordonnées : e-mail                   | Compte                                                              | Fonctionnement    |
| Santé et forme : santé                 | Effort ressenti, douleurs, blessures. Avec consentement             | Fonctionnement    |
| Santé et forme : forme                 | Séances validées, durées, charges, tests, records, essais de saut   | Fonctionnement    |
| Contenu utilisateur : photos ou vidéos | Vidéos de geste filmées ou choisies, images d'aperçu                 | Fonctionnement    |
| Contenu utilisateur : audio            | Piste son de la vidéo si le micro est autorisé, dictées envoyées à OpenAI | Fonctionnement    |
| Contenu utilisateur : autre            | Commentaires, annotations, annonces, consignes écrites pour l'IA    | Fonctionnement    |
| Identifiants : utilisateur             | Identifiant de compte                                               | Fonctionnement    |
| Identifiants : appareil                | Jeton de notification, identifiant d'installation                   | Fonctionnement    |
| Diagnostics : plantages                | Pile d'erreur Sentry, sans utilisateur. Non liée à l'identité       | Fonctionnement    |
| Diagnostics : autres                   | Version de l'app, dernière activité                                 | Fonctionnement, analyse |
| Autres données                         | Date de naissance, pied d'appel, consentements                      | Fonctionnement    |

Non collectés par l'app : localisation, contacts, historique de navigation, achats, données financières, identifiant publicitaire. La photothèque n'est ouverte que pour la vidéo choisie.

OpenAI : le texte écrit ou dicté, le nom des exercices et l'audio des dictées passent par le serveur Tartan, après accord explicite. OpenAI garde ses journaux de contrôle jusqu'à 30 jours : ces envois ne sont ni éphémères ni exclus de la collecte.

Sentry est embarqué et actif dès que `EXPO_PUBLIC_SENTRY_DSN` est défini, ce qui est le cas sur EAS en production depuis le 9 novembre 2026. Les cartes de sources demandent `SENTRY_AUTH_TOKEN` sur EAS ; à ce moment-là, retirer `SENTRY_DISABLE_AUTO_UPLOAD` de `eas.json`.

## Formulaire Google « Sécurité des données »

| Question                     | Réponse                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| Données chiffrées en transit | Oui (HTTPS, obligatoire hors développement)                                                           |
| Suppression à la demande     | Oui, dans l'app (Réglages) et par lien web                                                            |
| Partage avec des tiers       | Non au sens de Google : les prestataires (Vercel, Neon, Mux, Expo, Resend, Sentry, OpenAI) agissent sur instruction |
| Collecte obligatoire         | Nom, e-mail, activité sportive                                                                        |
| Collecte facultative         | Santé (consentement), vidéo, audio, messages, consignes pour l'IA                                     |

| Type Google               | Données                                                       | Finalité                          |
| ------------------------- | ------------------------------------------------------------- | --------------------------------- |
| Informations personnelles | Nom, e-mail, identifiants, date de naissance                  | Fonctionnement, gestion du compte |
| Santé et forme            | Effort, douleurs, blessures, séances, charges, tests, records | Fonctionnement                    |
| Photos et vidéos          | Vidéos de geste                                                | Fonctionnement                    |
| Fichiers audio            | Piste son des vidéos, dictées                                 | Fonctionnement                    |
| Messages                  | Commentaires et annonces                                      | Fonctionnement                    |
| Activité dans l'app       | Annotations, consignes écrites pour l'IA                      | Fonctionnement                    |
| Infos et performances     | Plantages Sentry, version de l'app                            | Fonctionnement, analyse           |
| Identifiants d'appareil   | Jeton de notification, identifiant d'installation             | Fonctionnement, sécurité          |

### Déclarations Play Console propres à cette version

- **Service au premier plan `dataSync`** (`FOREGROUND_SERVICE_DATA_SYNC`) : envoi d'une vidéo choisie par l'utilisateur, avec notification de progression, pour qu'il survive à la mise en veille. Google demande une courte vidéo de démonstration, à tourner sur un vrai téléphone.
- **Caméra, micro, notifications** : filmer un geste ; son de la vidéo ; séances et alertes. La galerie passe par le sélecteur système, sans `READ_MEDIA_*`.
- **Public cible** : 18 ans et plus uniquement, avec Restrict Minor Access. Chez Apple, passage obligatoire à 18+.
- **Contenu généré par les utilisateurs** : signalement de commentaire, d'annonce et de vidéo, et blocage d'un utilisateur, sont dans l'app. Les signalements sont traités dans les Réglages web.

## Reste à ta charge

Suivi à jour dans `docs/publication-stores.md`.

## Textes prêts à coller

### Fiche

| Champ | Texte |
| ---------------- | ---------------------------------------------------------------------------------- |
| Titre | Tartan – Préparation physique |
| Sous-titre Apple | Séances, suivi et vidéo |
| Mots-clés Apple | préparation physique,athlétisme,coach,entraînement,pliométrie,musculation,analyse vidéo |
| Description courte Google | Le carnet du coach d'athlé et du préparateur physique : séances, suivi, vidéo. |
| Catégorie | Sport (secondaire Apple : Forme et santé) |

Description longue :

> L'app de préparation physique du coach et de son groupe, pour l'athlétisme et les athlètes majeurs.
>
> Pour le coach : voyez qui a fait quoi, semaine par semaine. Faites l'appel, relancez un athlète, invitez votre groupe par lien ou QR code, consultez charges et feuille de barres. La création des séances se fait sur ordinateur.
>
> Pour l'athlète : ta séance du jour, tes exercices, leurs consignes et leurs vidéos. Tu valides en quelques secondes, même sans réseau : l'envoi part au retour de la connexion.
>
> Analyse vidéo : filmez ou importez un geste, revoyez-le image par image, commentez et partagez.
>
> Respect des données : effort ressenti et douleurs ne sont visibles qu'avec l'accord de l'athlète. Signalement, blocage et suppression du compte sont dans l'app.
>
> Application réservée aux 18 ans et plus. Compte Tartan requis. Tartan n'est pas un dispositif médical.

Retirés volontairement : mineurs, parents, prix, essai, offres, sprint, « 240 i/s conservés » tant que le scénario S11 n'est pas validé. Si S10 échoue, retirer « même sans réseau ». Captures : Aujourd'hui, mode séance, validation, grille coach, fiche athlète, analyse vidéo, avec données fictives majeures. Google demande en plus une bannière 1024 × 500.

### Apple : classification

Suivi : non. Contenu utilisateur oui, messagerie oui (prudent), réseau social non, publicité non, accès web non restreint non, santé et bien-être oui, informations médicales non, localisation partagée et rencontres non. Forcer 18+, URL d'âge https://tartan.coach/mobile/conditions. Ne pas cocher « Made for Kids ».

### Apple : notes de revue, à compléter

```
Tartan is a free companion app for athletics coaches, strength coaches
and their adult athletes. Users must be 18 or older. The app is in French.

The app contains no purchase, price or link to one. Coaches manage any
paid plan on our website; athletes never pay. Nothing is sold in the app.

Demo accounts (fictional data). On sign-in, tap "Utiliser un mot de passe".
Coach: [email] / [password]
Second coach: [email] / [password]
Athlete: [email] / [password]

Sessions are created on the web and followed here. Video capture needs
the camera; sound is optional.

AI planner (coach, Calendrier tab): the coach dictates or types training
instructions. Before anything is sent, the app names OpenAI, lists the
data and asks for explicit permission. Drafts are reviewed by the coach
before publication.

Report and block: "..." on a comment, announcement or video.
Account deletion: Settings, "Supprimer mon compte".
Tartan is not a medical device.
```

### Google : Data Safety et contenu

Partage : non, les prestataires (dont Sentry et OpenAI) agissent sur instruction. Traitement éphémère : non. Chiffrement en transit : oui. Suppression : oui, https://tartan.coach/suppression-compte. Obligatoires : nom, e-mail, identifiants, date de naissance, activité sportive, identifiants d'appareil, plantages et diagnostics. Facultatifs : santé, vidéos, audio, messages, consignes pour l'IA. Finalité : fonctionnement de l'app. Public : 18 ans et plus uniquement, Restrict Minor Access. Publicité : non. Déclaration santé : Activity and Fitness. Accès : comptes de démonstration. `dataSync` : cas envoi et téléchargement, interruption = envoi perdu. Vidéo sur vrai téléphone : choix d'une vidéo, envoi, notification de progression, écran éteint.
