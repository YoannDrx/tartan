# Lancement du pilote : ce qui reste à faire

Le code de la V1 est dans ce dépôt. Les étapes ci-dessous demandent tes comptes, ton frère ou de vrais téléphones : elles ne peuvent pas être faites depuis le code.

## À faire sans attendre

- [x] Réserver `tartan.coach` (acheté chez OVH le 1er novembre 2026).
- [ ] Réserver `tartancoach.com` et `tartancoach.fr`, à rediriger vers `tartan.coach` (disponibilités relevées le 31/10/2026, à revérifier).
- [ ] Lancer la recherche de marque INPI / EUIPO. Plans B : Tartanio, Elana.
- [ ] Ouvrir le compte Apple Developer et le compte Google Play Console (vérification d'identité).
- [ ] Constituer les 12 testeurs Android : Google Play impose 14 jours de test fermé aux comptes personnels récents.
- [ ] Faire valider le cahier par ton frère et répondre aux 8 questions du § 19.1.
- [ ] Préparer avec lui 30 à 50 exercices réels (noms, catégories, consignes, vidéos).

## Services à créer, puis variables à renseigner dans Vercel

| Service                 | Variables                                                                                                 | Sans elles                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Neon, région Francfort  | `DATABASE_URL`                                                                                            | Pas de production                       |
| Better Auth             | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`                                            | Pas de production                       |
| Resend, domaine vérifié | `RESEND_API_KEY`, `EMAIL_FROM`                                                                            | E-mails non envoyés                     |
| Mux                     | `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`, `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY` | Vidéo désactivée                        |
| Google OAuth            | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                                                | Bouton Google masqué                    |
| Apple                   | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`                                   | Bouton Apple masqué                     |
| Vercel Blob             | `BLOB_READ_WRITE_TOKEN`                                                                                   | Pas de photo de profil                  |
| Web Push                | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`                                                       | Pas de push navigateur                  |
| Tâches planifiées       | `CRON_SECRET`                                                                                             | Pas de relance ni de séance « manquée » |
| Liens d'app             | `APPLE_TEAM_ID`, `ANDROID_SHA256_FINGERPRINTS`                                                            | Les liens n'ouvrent pas l'app           |
| Expo et Firebase        | projet EAS, `google-services.json` pour FCM                                                               | Pas de build ni de push Android         |

Point d'attention Google : Apple exige une connexion équivalente dès que Google est proposé (règle 4.8) ; active les deux ensemble avant la soumission.

Webhook Mux à déclarer : `https://app.tartan.coach/api/webhooks/mux`.

## À valider sur de vrais appareils

- [ ] **Preuve de concept vidéo** (risque n°1 du projet) : lecture image par image et ralenti d'un 240 i/s sur iPhone et Android, avec une vraie vidéo Mux. Côté web, le test `e2e/video-poc.spec.ts` le valide sur Chromium avec un clip local. Le pas image par image repose sur le MP4 à pleine fréquence, comme prévu au § 11.5.
- [ ] Envoi vidéo en arrière-plan et reprise après coupure, y compris sur un Android d'entrée de gamme.
- [ ] Notifications sur iPhone, Android et desktop, actions depuis la notification comprises.
- [ ] VoiceOver, TalkBack et grandes tailles de texte sur les écrans clés.
- [ ] Liens d'invitation : app installée, app absente, passage par le store.

## Écarts connus de l'app mobile

Ces points s'écartent du cahier et demandent une décision ou un test sur appareil réel.

- **Ralenti depuis l'app** : `expo-camera` ne permet pas de choisir la fréquence. La caméra intégrée filme à la fréquence standard ; pour le 120 ou 240 i/s, le coach filme avec l'appareil photo natif puis importe. Filmer en ralenti dans l'app demande de passer à `react-native-vision-camera`.
- **Envoi vidéo** : il reprend après coupure, mais n'avance qu'app ouverte. Le vrai envoi en arrière-plan (§ 10.4 et 10.5) reste à faire, et ne se valide que sur appareil.
- **Notifications** : les boutons d'action rouvrent l'app au lieu de répondre sans l'ouvrir.
- **Google sur Android** : passe par une session web, pas par la connexion native du § 10.5.
- **Invitation à la première installation** : le lien n'est pas conservé après un passage par le store (lien différé non traité). L'athlète doit rouvrir le lien, ou passer par le web.
- **Android** : rien n'a tourné sur un appareil ni un émulateur, le module natif `tartan-camera-info` n'a jamais été compilé.

## Avant d'ouvrir à d'autres coachs

- [ ] Relecture juridique de `/confidentialite` et `/conditions`, dont tous les repères `[À DÉFINIR]` : éditeur, durées de conservation, droit applicable.
- [ ] Avis d'un juriste ou DPO sur la certification HDS et sur le traitement des mineurs (§ 15).
- [ ] Registre des traitements et contrats de sous-traitance.
- [ ] Sauvegardes quotidiennes et restauration testée sur Neon.
- [ ] Prix de l'offre payante : à valider auprès de 10 à 20 coachs (V2).

## Suivre le pilote

Point hebdomadaire avec le coach pendant 6 semaines. Les indicateurs du § 18 sortent de :

```bash
pnpm --filter @tartan/web exec tsx --env-file=.env scripts/pilot-metrics.ts <organisationId>
```

Deux indicateurs ne se calculent pas seuls : « usage coach » (toutes les séances passent par Tartan) et la satisfaction, à relever avec lui.
