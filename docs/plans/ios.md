# Plan : publier sur l'App Store

Application `coach.tartan.app`, iPhone seul, version 1.1.0, Expo 55. Textes et formulaires : [fiches-stores](../reference/fiches-stores.md). L'avancement est dans [../ETAT.md](../ETAT.md).

## Déjà en place

- Compte développeur, identifiant d'application, liens universels en ligne.
- Fiche App Store Connect 1.1.0 : nom, sous-titre, catégories, classification 18+, gratuit, France, URL de confidentialité, publication manuelle.
- App Privacy saisi, non publié.
- 8 captures 1320 × 2868, envoyées. Elles sont dans `apps/mobile/store/ios`.
- Archive 1.1.0 (12) envoyée à Apple. Elle contient l'accord OpenAI, mais pas les correctifs I1 et I2 : **à reconstruire depuis `main`** une fois ces correctifs fusionnés.
- `ITSAppUsesNonExemptEncryption` à `false`. Suppression de compte dans l'app. Signalement et blocage.

## Étapes

| N° | Action | Qui | Vérification |
| --- | --- | --- | --- |
| I1 | Corriger le changement de compte par lien magique, sans déconnexion (M4) | Agent | Flux Maestro dédié |
| I2 | Repli HLS du lecteur natif quand le MP4 n'est pas prêt (M5) | Agent | Vidéo lue juste après l'encodage |
| I3 | Rendre les flux Maestro non conditionnels (T09) | Agent | Échec si aucune séance |
| I4 | Compléter les captures, dont l'analyse vidéo ([procédure](../exploitation/captures.md)) | Agent | `pnpm captures --store` |
| I5 | Confirmer la clé APNs par un vrai push sur TestFlight | Fondateur, agent | Notification reçue, lien vers la bonne séance |
| I6 | Lever le plafond Mux (W6) | Fondateur | Un relecteur peut filmer |
| I7 | Vérifier le compte de revue : le coach de démonstration en offre Coach, un second coach de réserve | Fondateur | Connexion par mot de passe, planificateur visible |
| I8 | Reconstruire depuis le commit validé | Agent : `eas build --profile production --platform ios`, ou en local si EAS échoue | Numéro de build supérieur à 12 |
| I9 | Envoyer sur TestFlight, recette physique ([section 6](../tests/recette-reelle.md)) | Fondateur | Toutes les cases cochées |
| I10 | Téléphone public et statut de commerçant dans App Store Connect | Fondateur | Accepté par Apple |
| I11 | Publier App Privacy | Fondateur | Déclaration publiée |
| I12 | Mot de passe du compte de revue et notes en anglais dans App Store Connect | Fondateur | Modèle dans les fiches |
| I13 | Avis du juriste (F4), puis « Soumettre pour vérification » | Fondateur | État « En attente de vérification » |
| I14 | Répondre à la revue, 48 heures en moyenne | Fondateur, agent | Approbation |
| I15 | Publier manuellement, déclarer la version dans `packages/i18n/src/releases.ts` | Fondateur, agent | Fiche visible, notes de version diffusées |

## Ce qu'on publie et comment

`pnpm release:new 1.2.0 --store` crée l'entrée de version. Le workflow GitHub « Publier le mobile », mode `store`, lance `eas build --auto-submit`. Il exige le secret `EXPO_TOKEN` et une clé App Store Connect stockée sur EAS. Mode `ota` pour une mise à jour sans code natif.

## Si Apple refuse au titre de 3.1.1

Risque réel : l'exception 3.1.3(f) vise la VoIP, le stockage, l'e-mail et l'hébergement, pas un outil de coaching.

1. Répondre factuellement : aucune vente dans l'app, offre souscrite sur le web, aucune mention de prix.
2. Si le refus tient, ajouter l'achat intégré. Le webhook RevenueCat existe côté serveur (`apps/web/app/api/webhooks/revenuecat`) ; le SDK reste à intégrer à `apps/mobile`, avec tests de la route (T02).
3. Alternative : ne laisser dans l'app que les usages athlète et ouverture d'un compte existant, selon la réponse d'Apple.

## Pièges

- `EXPO_PUBLIC_OAUTH_GOOGLE_ENABLED` ne se pose jamais sans l'option Apple (règle 4.8).
- Connexion Apple : la révocation à la suppression du compte est incomplète (M6). Ne l'active pas avant.
- Une mise à jour à distance ne vise que les binaires de la même version native.
- Apple interdit les fonctions dormantes (2.5.19) : l'autorisation micro parle de dictée, l'IA doit donc être accessible au relecteur.
- Écran du coach : un relecteur peut supprimer le compte de revue. Garde un second compte.
