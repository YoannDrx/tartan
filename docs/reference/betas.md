# Bêtas iOS et Android : textes prêts à coller

Lots 5 (TestFlight externe) et 7 (test fermé Google Play) du plan du 15 novembre 2026. Ce fichier ne contient **aucun identifiant** : le dépôt est public. Les mots de passe des comptes de revue se saisissent dans App Store Connect et Play Console, jamais ici. La fiche publique commune (titre, descriptions, confidentialité) est dans [fiches-stores.md](fiches-stores.md) ; la marche à suivre dans [ios.md](../plans/ios.md) et [android.md](../plans/android.md).

Ce qui revient au fondateur : envoyer la bêta à la revue d'Apple, créer le compte Play (D-U-N-S), saisir les mots de passe de revue, inviter les testeurs, accepter les conditions des deux stores.

## Lot 5 : TestFlight, bêta externe

### Informations de test (App Store Connect → TestFlight → Informations de test)

| Champ | Texte |
| --- | --- |
| Adresse de retour | hello@tartan.coach |
| URL marketing | https://tartan.coach |
| URL de confidentialité | https://tartan.coach/mobile/confidentialite |
| Langue | Français |

**Description de la bêta** (4 000 signes au plus) :

> Tartan est l'application de préparation physique du coach et de son groupe, pour l'athlétisme et les athlètes majeurs.
>
> Cette bêta sert à vérifier l'application sur de vrais téléphones avant son ouverture : le coach prépare des séances (circuits, supersets, séries détaillées), suit son groupe et annote des vidéos ; l'athlète reçoit sa séance du jour, la réalise en mode séance et la valide en quelques secondes, même sans réseau.
>
> Il faut un compte Tartan : ton coach t'invite par un lien ou un QR code. L'application est réservée aux 18 ans et plus. Elle n'est pas un dispositif médical.
>
> Pour un retour, fais une capture d'écran dans TestFlight ou écris à hello@tartan.coach.

**À tester** (par build, 4 000 signes au plus) :

> Merci de tester sur ton propre téléphone, avec ton vrai usage :
>
> 1. Connexion par lien magique ou mot de passe, et ouverture d'une invitation.
> 2. Athlète : la séance du jour, le mode séance (minuteur, séries cochées une à une, séries détaillées avec leur charge), puis la validation avec l'effort ressenti.
> 3. Hors réseau : valide une séance en mode avion, puis rallume le réseau ; la validation doit partir seule.
> 4. Notifications : une nouvelle séance publiée, une relance du coach ; le toucher doit ouvrir la bonne séance.
> 5. Coach : construire une séance avec un circuit, détailler un exercice série par série, remplacer un exercice pour les athlètes en autonomie, publier.
> 6. Vidéo : filmer ou choisir un geste, l'envoyer, puis lire la remarque du coach et ses tracés.
>
> Signale tout écran coupé, texte illisible, bouton difficile à toucher ou action qui semble ne rien faire.

### Revue bêta d'Apple (Beta App Review Information)

Connexion requise : oui. Les identifiants se saisissent dans les champs « Nom d'utilisateur » et « Mot de passe » d'App Store Connect : un coach de démonstration en offre Coach (pour que le planificateur soit visible, règle 2.5.19), avec ses données fictives ([procédure](fiches-stores.md#compte-de-démonstration)). Coordonnées de contact : celles du fondateur, saisies dans App Store Connect.

**Notes pour la revue** (en anglais, sans identifiant) :

```
Tartan is a free companion app for athletics and strength coaches and
their adult athletes (18+). The app is in French.

Sign-in: on the first screen, tap "Utiliser un mot de passe", then use
the demo coach account entered in the sign-in fields of this form. The
account holds fictional data only. Please keep it: deleting it would
remove the demo group.

The app contains no purchase, price or link to one. Coaches manage any
paid plan on our website; athletes never pay.

What to look at:
- Coach: "Calendrier" tab, open a session or create one; "Suivi" tab
  shows who trained this week.
- AI planner (Calendrier): before anything is sent, the app names
  OpenAI, lists the data and asks for explicit permission.
- Video: the camera is used to film a movement; sound is optional.

Report and block: "..." on a comment, announcement or video.
Account deletion: Settings, "Supprimer mon compte".
Tartan is not a medical device.
```

## Lot 7 : Google Play, test fermé

### Profil d'envoi

`apps/mobile/eas.json`, profil `beta` : le binaire de production (`APP_VARIANT=production`, paquet `coach.tartan.app`, API `https://app.tartan.coach`), canal de mise à jour `beta`, envoyé sur la piste **`alpha`**, qui est la piste de test fermé de Play Console, en brouillon (`releaseStatus: draft`) : rien n'est diffusé sans action dans la console. La clé du compte de service (`google-play-service-account.json`) est ignorée par Git et se crée à l'étape G4.

```sh
eval "$(node scripts/profile-env.mjs beta)"
corepack pnpm --filter @tartan/mobile exec eas build --profile beta --platform android --auto-submit
```

### Fiche Play (Présence sur le Store → Fiche principale)

Titre, description courte et description longue : [fiches-stores.md](fiches-stores.md#textes-prêts-à-coller). Graphique de fonctionnalité 1024 × 500 et icône 512 × 512 : `apps/mobile/store/android`. Captures 1080 × 1920 : [procédure](../exploitation/captures.md).

**Notes de version du test fermé** (500 signes au plus) :

> Première bêta Android de Tartan : séance du jour et mode séance, validation hors réseau, constructeur de séances pour le coach (circuits, séries détaillées, remplacement en autonomie), suivi du groupe et analyse vidéo annotée. Merci de signaler tout écran coupé ou toute action qui ne répond pas à hello@tartan.coach.

**Instructions aux testeurs** (page d'inscription au test fermé) :

> Tartan est réservé aux 18 ans et plus et demande un compte : ton coach t'invite par un lien. Installe la bêta depuis ce lien, connecte-toi, puis utilise l'application comme d'habitude. Pour un retour : hello@tartan.coach.

**Accès à l'application** (Contenu de l'application → Accès à l'application) : « Toutes les fonctionnalités ou certaines sont restreintes », instructions en anglais ci-dessous ; le nom d'utilisateur et le mot de passe se saisissent dans les champs de la console.

```
Sign in with a password: tap "Utiliser un mot de passe" on the first
screen. The demo coach account holds fictional data only. The app is in
French and reserved to users aged 18 and over.
```

### Brouillon « Sécurité des données »

Relevé du code au 16 novembre 2026, à relire par le fondateur avant envoi. Base et justification : [fiches-stores.md](fiches-stores.md#formulaire-google--sécurité-des-données-).

| Question de la console | Réponse |
| --- | --- |
| L'application collecte-t-elle ou partage-t-elle des données ? | Oui |
| Toutes les données sont-elles chiffrées en transit ? | Oui |
| Les utilisateurs peuvent-ils demander la suppression ? | Oui, dans l'app et sur https://tartan.coach/suppression-compte |
| Données partagées avec des tiers | Aucune : les prestataires agissent pour le compte de Tartan |

| Type de données | Collecté | Facultatif | Finalités | Traitement éphémère |
| --- | --- | --- | --- | --- |
| Informations personnelles : nom | Oui | Non | Fonctionnement, gestion du compte | Non |
| Informations personnelles : adresse e-mail | Oui | Non | Fonctionnement, gestion du compte, communications | Non |
| Informations personnelles : identifiants utilisateur | Oui | Non | Fonctionnement, gestion du compte | Non |
| Informations personnelles : autres (date de naissance) | Oui | Non | Fonctionnement (accès réservé aux majeurs) | Non |
| Santé et remise en forme : informations de santé (effort ressenti, douleurs, blessures) | Oui | Oui, avec consentement | Fonctionnement | Non |
| Santé et remise en forme : informations de remise en forme (séances, charges, records) | Oui | Non | Fonctionnement | Non |
| Photos et vidéos : vidéos | Oui | Oui | Fonctionnement | Non |
| Fichiers audio : enregistrements vocaux (dictées), autres audio (son des vidéos) | Oui | Oui | Fonctionnement | Non |
| Messages : autres messages dans l'application (commentaires, annonces) | Oui | Oui | Fonctionnement | Non |
| Activité dans l'application : autres actions (annotations, consignes écrites pour l'IA) | Oui | Oui | Fonctionnement | Non |
| Infos et performances de l'app : plantages, diagnostics | Oui | Non | Fonctionnement, analyse | Non |
| Identifiants de l'appareil ou autres | Oui | Non | Fonctionnement, sécurité | Non |

Non collectés : position, contacts, agenda, historique web, achats, informations financières, identifiant publicitaire, SMS, fichiers.

### Brouillon de la déclaration des applications de santé

| Question | Réponse |
| --- | --- |
| Fonctionnalités de santé | Activité et remise en forme (« Activity and Fitness ») : préparation physique, suivi des séances et des charges |
| Dispositif médical, diagnostic, traitement | Non. Mention « Tartan n'est pas un dispositif médical » dans la fiche et les conditions |
| Recherche sur des sujets humains | Non |
| Données de santé : effort ressenti, douleurs, blessures | Collectées seulement avec le consentement santé de l'athlète, visibles par son coach, jamais dans les journaux, notifications ni analyses d'usage |
| Health Connect | Non utilisé |

### Brouillon du questionnaire de classification et du public

| Rubrique | Réponse |
| --- | --- |
| Catégorie de l'application | « Toutes les autres applications » (ni jeu, ni réseau social, ni éducation) |
| Violence, sexualité, langage, substances, jeux d'argent | Non |
| Les utilisateurs interagissent-ils ? | Oui : commentaires, annonces et vidéos partagées dans le groupe du coach ; signalement et blocage dans l'app |
| Partage de la position | Non |
| Achats numériques | Non |
| Public cible | 18 ans et plus uniquement ; « Restreindre l'accès aux mineurs » activé |
| Publicités | Non |

## Vérifié par l'agent le 16 novembre 2026

- `eas.json` : le profil `beta` hérite de la production et vise la piste `alpha` en brouillon.
- `assetlinks.json` : la route répond 404 tant que `ANDROID_SHA256_FINGERPRINTS` est vide, ce qui est le cas en production (`https://tartan.coach/.well-known/assetlinks.json`, `https://app.tartan.coach/.well-known/assetlinks.json`), puis publie chaque empreinte pour `coach.tartan.app` (`tests/well-known.test.ts`). L'app déclare les liens des deux domaines avec `autoVerify`. À l'étape G8, poser l'empreinte SHA-256 du certificat de signature de Play App Signing, suivie de celle de la clé d'envoi d'EAS (séparées par une virgule) pour que les binaires envoyés hors Play vérifient aussi leurs liens, puis redéployer.

## Suspendre les invitations et revenir à un candidat éprouvé

1. Pour suspendre les nouveaux envois, régler `BETA_INVITES_ENABLED=false` sur l’environnement de production Vercel et redéployer le commit de production. Vérifier la version sur `/api/v1/version` et la santé sur `/api/health`. Les liens individuels déjà émis restent utilisables jusqu’à expiration ou révocation. Pour retirer un accès, utiliser la console privée, puis vérifier le retrait du groupe fournisseur.
2. Pour une première installation Android, restaurer le couple `BETA_APK_PATH` et `BETA_APK_VERSION` du candidat éprouvé et redéployer. Contrôler l’empreinte du fichier servi par le lien privé en recette. Pour un téléphone déjà passé au binaire défectueux, reconstruire la révision éprouvée avec la même signature et un `versionCode` supérieur à celui déjà installé. Cette mise à jour préserve les données locales de l’application. [Gestion des versions Android](https://developer.android.com/studio/publish/versioning)
3. Pour iOS, choisir dans le groupe TestFlight un build encore valide et autorisé au test externe, puis faire correspondre `BETA_ASC_BUILD_ID` à ce build. Contrôler l’état de la revue et l’accès du groupe avant de reprendre les invitations.
4. Pour une mise à jour JavaScript ou des images, relever le groupe de mise à jour éprouvé, son canal et ses empreintes iOS et Android. Refaire publier ce groupe sur la branche `beta` avec `eas update:republish --group <groupe-éprouvé>`. Les appareils recevront la correction lorsqu’ils pourront la télécharger. Vérifier les deux empreintes et l’ouverture d’une séance hors ligne. [Retour à une mise à jour Expo](https://docs.expo.dev/eas-update/debug/)
