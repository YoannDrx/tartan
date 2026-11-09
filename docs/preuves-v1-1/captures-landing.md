# Captures du site — mode opératoire

Tout écran montré sur le site est une vraie capture, listée dans `apps/web/src/features/landing/images/provenance.json`. Un test refuse toute image qui n'y figure pas.

`pnpm captures` enchaîne tout : barre d'état normalisée, liens profonds, `xcrun simctl io booted screenshot`, réduction `sips -Z 1600`, écriture dans le dossier des images, puis Playwright pour le bureau coach et mise à jour de `provenance.json`. Maestro n'est pas utilisé : ce script tient le même rôle.

## Prérequis

1. Base locale jetable, migrée, puis `DATABASE_URL=… pnpm --filter @tartan/web demo:preparation` (refusé hors base locale).
2. Serveur web local sur cette base, avec `VIDEO_DEV_MP4_URL` pointant vers un clip servi localement (dossier `public/`, jamais commité).
3. App iOS en Release sur un simulateur démarré, sans menu de développement :

   ```bash
   EXPO_PUBLIC_API_URL=http://localhost:3000 EXPO_PUBLIC_WEB_URL=http://localhost:3000 SENTRY_DISABLE_AUTO_UPLOAD=true pnpm --filter @tartan/mobile exec expo run:ios --configuration Release --device "iPhone 17 Pro" --no-bundler
   ```

   `pnpm captures --build` lance cette commande avant les captures.

4. Dans l'app, connexion manuelle avec `athlete@capture.tartan.test` : le script ne saisit rien à l'écran.

## Lancer

- `pnpm captures --dry-run` : lit les identifiants et affiche chaque commande, sans rien exécuter ni écrire.
- `pnpm captures` : tout. `--only=ios` ou `--only=web` pour une moitié.

`DATABASE_URL` vient de l'environnement, sinon de `apps/web/.env`. Toute base ou tout serveur web qui n'est pas local est refusé. Les séances capturées sont celles à venir du coach de démonstration, ouvertes par `tartan-dev://session/<id>?i=<rang de l'exercice>`. `demo:preparation` met l'athlète en vue Mois pour la capture du calendrier.

Les images iOS ne remplacent les anciennes qu'une fois tous les écrans réussis. Si iOS demande de confirmer l'ouverture d'un lien, accepte puis relance.

Clip de l'écran d'analyse : Pexels, « Athlete Sprinting on Outdoor Track » par Official Amit, https://www.pexels.com/video/athlete-sprinting-on-outdoor-track-37264421/. Le nom affiché et les remarques sont fictifs ; la légende du site l'indique. Les mêmes captures servent aux fiches des stores.
