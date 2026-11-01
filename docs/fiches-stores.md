# Fiches stores et formulaires de confidentialité

Base : cahier § 4.4 et § 16, et ce que l'app collecte réellement (code de `apps/mobile`, `docs/etat-des-lieux-et-plan.md`). Brouillon à relire par toi et le juriste avant envoi. Rien n'a été saisi dans App Store Connect ni dans la Play Console.

## Fiche commune

| Élément | Texte | Limite |
| --- | --- | --- |
| Nom | Tartan – Coach athlé | 30 (Apple, Google), 20 utilisés |
| Sous-titre Apple | Séances, suivi et vidéo | 30, 23 utilisés. La formule du § 4.4 (« Séances, suivi et vidéo pour ton groupe ») en fait 39 : trop longue |
| Mots-clés Apple | `athlétisme,coach,entraînement,saut en hauteur,sprint,pliométrie,musculation,analyse vidéo,club` | 100, 94 utilisés |
| Catégorie | Sport (secondaire : Forme et santé) | |
| Description courte Google | Le carnet du coach d'athlé et de son groupe : séances, suivi et analyse vidéo. | 80 |

**À trancher :** le mot-clé « sprint » vient du § 4.4, mais le module sprint est en V2. Il n'est repris ni dans le sous-titre ni dans la description. Retire-le s'il te semble promettre trop.

### Description

Le carnet d'entraînement partagé du coach d'athlétisme et de son groupe.

**Pour le coach**
Sur le terrain, voyez d'un coup d'œil qui a fait quoi, semaine par semaine. Faites l'appel, relancez un athlète, invitez votre groupe avec un lien ou un QR code, consultez la charge et la feuille de barres de chacun.

**Pour l'athlète**
Ta séance du jour, tes exercices avec leurs consignes et leurs vidéos. Tu valides en quelques secondes, même sans réseau : l'envoi part dès que la connexion revient.

**Analyse vidéo**
Filmez au ralenti ou importez depuis la pellicule. Chaque image d'un 240 i/s est conservée. Revoyez le saut image par image, découpez-le par phases, commentez sur la timeline et partagez avec l'athlète.

**Respect des données**
Effort ressenti et douleurs ne sont visibles qu'avec l'accord de l'athlète, et l'accord d'un parent est demandé pour les plus jeunes. Le compte se supprime depuis l'app.

Conçue pour le saut en hauteur et ses préparations physiques.

### Adresses

| Élément | Adresse |
| --- | --- |
| Confidentialité | https://tartan.coach/confidentialite |
| Conditions | https://tartan.coach/conditions |
| Assistance | https://tartan.coach/contact |
| Suppression de compte (web, exigé par Google) | https://tartan.coach/suppression-compte |

### Compte de démonstration

Un compte coach et un compte athlète (§ 16.1), à créer sur la production par toi, adresse confirmée. Le `seed` passe par la confirmation d'adresse : il faudra le rejouer sans envoi d'e-mail. Tant qu'ils n'existent pas, la review ne peut pas entrer dans l'app.

## Formulaire Apple « App Privacy »

Aucun suivi publicitaire (« Tracking : non »). Toutes les données sont liées à l'identité de l'utilisateur et servent au fonctionnement de l'app.

| Catégorie Apple | Données réelles | Finalité déclarée |
| --- | --- | --- |
| Coordonnées : nom | Prénom, nom | Fonctionnement |
| Coordonnées : e-mail | Compte ; e-mail d'un parent pour un mineur | Fonctionnement |
| Santé et forme : santé | Effort ressenti, douleurs, blessures. Avec consentement | Fonctionnement |
| Santé et forme : forme | Séances validées, durées, charges, tests, records, essais de saut | Fonctionnement |
| Contenu utilisateur : photos ou vidéos | Vidéos de saut filmées ou choisies, images d'aperçu | Fonctionnement |
| Contenu utilisateur : audio | Piste son de la vidéo si le micro est autorisé. Coupée à la lecture | Fonctionnement |
| Contenu utilisateur : autre | Commentaires, annotations, annonces | Fonctionnement |
| Identifiants : utilisateur | Identifiant de compte | Fonctionnement |
| Identifiants : appareil | Jeton de notification | Fonctionnement |
| Autres données | Date de naissance, pied d'appel, consentements | Fonctionnement |

Non collectés par l'app : localisation, contacts, historique de navigation, données financières (vente coupée, aucun achat intégré), identifiant publicitaire. L'app mobile n'embarque ni analyse d'usage ni suivi d'erreurs. La photothèque n'est ouverte que pour la vidéo choisie : l'accès demandé sur iOS sert à garder la pleine fréquence, rien d'autre n'en sort.

**À revoir avant envoi :** si Sentry ou une analyse d'usage arrive sur le mobile, ajouter « Données de diagnostic ».

## Formulaire Google « Sécurité des données »

| Question | Réponse |
| --- | --- |
| Données chiffrées en transit | Oui (HTTPS, obligatoire hors développement) |
| Suppression à la demande | Oui, dans l'app (Réglages) et par lien web |
| Partage avec des tiers | Non au sens de Google : les prestataires (Vercel, Neon, Mux, Expo, Resend) agissent en sous-traitants |
| Collecte obligatoire | Nom, e-mail, activité sportive |
| Collecte facultative | Santé (consentement), vidéo et audio (consentement) |

| Type Google | Données | Finalité |
| --- | --- | --- |
| Informations personnelles | Nom, e-mail, identifiants, date de naissance | Fonctionnement, gestion du compte |
| Santé et forme | Effort, douleurs, blessures, séances, charges, tests, records | Fonctionnement |
| Photos et vidéos | Vidéos de saut | Fonctionnement |
| Fichiers audio | Piste son des vidéos | Fonctionnement |
| Messages | Commentaires et annonces | Fonctionnement |
| Identifiants d'appareil | Jeton de notification | Fonctionnement |

### Déclarations Play Console propres à cette version

- **Service au premier plan `dataSync`** (`FOREGROUND_SERVICE_DATA_SYNC`) : envoi d'une vidéo choisie par l'utilisateur, avec notification de progression, pour qu'il survive à la mise en veille. Google demande une courte vidéo de démonstration, à tourner sur un vrai téléphone.
- **Caméra, micro, notifications** : filmer un saut ; son de la vidéo ; séances et alertes. La galerie passe par le sélecteur système, sans `READ_MEDIA_*`.
- **Public cible** : l'app admet des mineurs, avec accord d'un parent en dessous de 15 ans. À faire valider par le juriste avant de remplir ce formulaire et la classification d'âge d'Apple.
- **Contenu généré par les utilisateurs** : signalement de commentaire, d'annonce et de vidéo, et blocage d'un utilisateur, sont dans l'app. Les signalements sont traités dans les Réglages web.

## Reste à ta charge

1. Ouvrir les comptes Apple et Google, créer le projet EAS (`eas init`), puis définir `EAS_PROJECT_ID`, `APPLE_TEAM_ID` et, côté web, `APPLE_TEAM_ID` et `ANDROID_SHA256_FINGERPRINTS`.
2. Créer Firebase, poser `apps/mobile/google-services.json` (ignoré par git) ou la variable de fichier EAS `GOOGLE_SERVICES_JSON`.
3. Poser `apps/mobile/google-play-service-account.json` (ignoré par git) pour `eas submit` ; renseigner `ascAppId` dans `eas.json` quand la fiche App Store existera.
4. Captures d'écran des fiches : à prendre sur le build de production, avec le compte de démonstration.
