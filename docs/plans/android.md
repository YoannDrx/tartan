# Plan : publier sur Google Play

Paquet `coach.tartan.app`, API 36. Textes et formulaires : [fiches-stores](../reference/fiches-stores.md). L'avancement est dans [../ETAT.md](../ETAT.md).

## Déjà en place

Projet Firebase et `GOOGLE_SERVICES_JSON` sur EAS. Clé de signature Android sur EAS. Bannière 1024 × 500 dans `apps/mobile/store/android`. Icône 512 × 512. Compilation Android vérifiée en CI à chaque PR mobile. Les pages `/mobile/*` sont sans prix.

## Lecture vidéo : media3 et CameraX

`react-native-vision-camera` tire CameraX 1.7 (alpha), qui hisse toutes les bibliothèques media3 en 1.9. `expo-video` 55 est compilé contre media3 1.8 : sans correctif, la première vidéo lue ferme l'app (`AbstractMethodError` sur `LoadControl.getAllocator(PlayerId)`). Le patch `patches/expo-video@55.0.21.patch` ajoute cette méthode, et `expo-video` est compilé depuis ses sources sur Android (`buildFromSource` dans `apps/mobile/package.json`). À chaque montée d'`expo-video`, pnpm refuse le patch : vérifier alors si la nouvelle version vise media3 1.9, et retirer patch et `buildFromSource` si oui. Vérifié sur émulateur le 13 novembre 2026, pas encore sur un téléphone.

## Le blocage à lever d'abord

Les builds EAS échouaient à l'étape « Read app config » (`expo config --json --full --type public` : « Unexpected token '{' »), alors que le même commit se construisait en local.

**Cause, trouvée le 12 novembre 2026.** `app.config.ts` importe deux fichiers TypeScript (`packages/i18n/src/fr.ts`, `src/lib/app-variant.ts`). Ils n'étaient lisibles que grâce au support natif du TypeScript de Node, présent en local et en CI, absent sur la machine de build EAS. Reproduit en local avec `NODE_OPTIONS="--no-experimental-strip-types"`.

**Correction.** `import "tsx/cjs"` en tête de `app.config.ts` (méthode documentée par Expo), `tsx` en dépendance de développement du mobile. `src/lib/app-config.test.ts` relit la configuration de production sans le support natif : il échoue sans la correction.

**Régression.** Le résultat des builds vit dans ETAT.md. Pour reconstruire le commit validé et vérifier que « Read app config » reste fonctionnel :

```sh
corepack pnpm --filter @tartan/mobile exec eas build --profile production --platform android
```

## Étapes

| N° | Action | Qui | Vérification |
| --- | --- | --- | --- |
| G1  | Demander un D-U-N-S pour l'entreprise. Compte organisation retenu ; aucun repli personnel                | Fondateur        | Numéro reçu, jusqu'à 30 jours                                  |
| G2 | Créer le compte Play Console, déclarer le statut de commerçant, créer l'app | Fondateur | App visible dans la console |
| G3 | Compte de service Firebase, importé en FCM V1 : `eas credentials -p android` | Fondateur | Push reçu sur un Android physique |
| G4 | Compte de service Play, importé sur EAS pour `eas submit` | Fondateur | `eas submit` accepté |
| G5 | Corriger le build (bloc ci-dessus, tâche M1 de l'état) | Agent | AAB signé |
| G6 | Captures 1080 × 1920, au moins quatre ([procédure](../exploitation/captures.md)) | Agent | Ratio inférieur à 2:1 |
| G7 | Envoyer l'AAB sur le canal interne | Agent, fondateur | Installable depuis Play |
| G8 | Relever l'empreinte SHA-256 de signature Play, la poser dans `ANDROID_SHA256_FINGERPRINTS`, redéployer | Fondateur | `assetlinks.json` répond 200, lien universel ouvert dans l'app |
| G9 | Remplir Data Safety, déclaration santé (« Activity and Fitness »), public 18 ans et plus, classification | Fondateur | Formulaires validés |
| G10 | Vidéo de démonstration du service `dataSync` (choisir la vidéo, envoi, notification, écran éteint) | Fondateur | Déclaration acceptée |
| G11 | Recette physique, entrée de gamme ([section 6](../tests/recette-reelle.md)) | Fondateur | Toutes les cases cochées |
| G12 | Compte de revue : identifiants en anglais, connexion par mot de passe | Fondateur | Accès vérifié la veille |

## Selon le type de compte

| Compte | Suite |
| --- | --- |
| Organisation (D-U-N-S) | Canal interne puis bêta sur invitation ; recette physique avant toute demande de production, revue et délais selon Google                                   |
| Personnel récent | Test fermé avec 15 à 20 personnes pendant 14 jours sans interruption (12 restent requises), retours réels, demande d'accès à la production, puis soumission |

Un testeur qui se retire avant 14 jours ne compte plus. Prévois de la marge. Google interroge ensuite sur le déroulé du test.

## Pièges

- Le grand côté d'une capture ne peut pas dépasser deux fois le petit : les captures du site ne conviennent pas.
- Identifiants de revue valables partout, lien magique refusé.
- Le statut de commerçant rend adresse et téléphone publics. Une fausse déclaration peut suspendre le compte.
- Limite Android de 6 heures sur 24 pour un service `dataSync`.
- Paiements : l'app de consultation seule est admise, à condition de n'avoir aucun lien vers un paiement.
