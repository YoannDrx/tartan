# Captures du site — mode opératoire

Tout écran montré sur le site est une vraie capture, listée dans `apps/web/src/features/landing/images/provenance.json`. Un test refuse toute image qui n'y figure pas.

1. Base locale jetable, migrée, puis `DATABASE_URL=… pnpm --filter @tartan/web demo:preparation` (refusé hors base locale).
2. Serveur web local, avec `VIDEO_DEV_MP4_URL` pointant vers un clip servi localement (dossier `public/`, jamais commité).
3. App iOS en Release, sans menu de développement :

   ```bash
   EXPO_PUBLIC_API_URL=http://localhost:3000 EXPO_PUBLIC_WEB_URL=http://localhost:3000 SENTRY_DISABLE_AUTO_UPLOAD=true pnpm --filter @tartan/mobile exec expo run:ios --configuration Release --device "iPhone 17 Pro" --no-bundler
   ```

4. Barre d'état : `xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100`.
5. Écrans : liens `tartan-dev://session/<id>`, `tartan-dev://video/<id>`, `tartan-dev://agenda`, `tartan-dev://progress`, puis `xcrun simctl io booted screenshot`. Réduire avec `sips -Z 1600`.
6. Bureau coach : `CAPTURE_BASE_URL=http://localhost:3000 pnpm --filter @tartan/web exec playwright test e2e/captures.spec.ts --project=desktop`.

Clip de l'écran d'analyse : Pexels, « Athlete Sprinting on Outdoor Track » par Official Amit, https://www.pexels.com/video/athlete-sprinting-on-outdoor-track-37264421/. Le nom affiché et les remarques sont fictifs ; la légende du site l'indique. Les mêmes captures servent aux fiches des stores.
