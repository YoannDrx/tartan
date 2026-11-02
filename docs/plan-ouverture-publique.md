# Plan d'ouverture publique

Établi le 2 novembre 2026. Il remplace la liste du § 17 de `docs/etat-des-lieux-et-plan.md` pour tout ce qui mène à l'ouverture.

**Ta décision :** la web app ouvre au public sans attendre la fin du pilote, dès que le vrai paiement est testé, que le médiateur est désigné et que le juriste a rendu son avis. Le pilote et les apps mobiles avancent en parallèle.

## Où on en est

| Sujet              | État vérifié le 2 novembre                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Production         | `tartan.coach` et `app.tartan.coach` répondent, `/api/health` à `ok`, déploiement `3095f0b` en ligne, CI de `main` verte   |
| Code du plan       | Phases 0 à 6 écrites et testées. Il manque surtout des essais réels, des comptes et des décisions, pas des fonctionnalités |
| Paiement           | Compte Stripe activé, 4 prix actifs et conformes au code. Aucun vrai paiement encore passé                                 |
| Sauvegarde         | Copie chiffrée chaque nuit, restauration testée                                                                            |
| Suivi d'erreurs    | Sentry reçoit les erreurs de production                                                                                    |
| Branche de travail | `feat/sprint-0-fondations` contient la landing et ces correctifs, **pas encore en ligne**                                  |

## Ce qui bloque l'ouverture

Sans ces 7 points, on n'ouvre pas.

| #   | Point                                                    | Pourquoi ça bloque                                                                                     | Qui           |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------- |
| 1   | Avis écrit du juriste (`docs/conformite.md`)             | Vidéos de mineurs hébergées aux États-Unis, données de santé (HDS), rôle de responsable de traitement  | Toi           |
| 2   | Adhésion au médiateur, puis CGV complétées               | `/cgv` affiche encore `[À DÉFINIR]`, et la médiation est obligatoire pour vendre à des particuliers    | Toi, puis moi |
| 3   | Retirer « version de travail » des pages légales         | Mention visible par tous, à retirer seulement après l'avis du juriste                                  | Moi           |
| 4   | Vrai paiement remboursé, puis résiliation                | Seul test possible du webhook, de la clé secrète et de la facture 293 B                                | Toi, avec moi |
| 5   | Carte sur Mux, puis retrait de `MUX_VIDEO_LIMIT`         | **La limite de 10 vidéos vaut pour tout Tartan** : quelques coachs suffiraient à bloquer tout le monde | Toi, puis moi |
| 6   | Passage à Neon Launch, restauration testée               | Prévu « avant la vente » : l'offre gratuite limite la capacité et la restauration                      | Toi, puis moi |
| 7   | Recette réelle côté athlète, sur un iPhone et un Android | Lien magique, invitation, validation, notifications et hors ligne jamais essayés sur un vrai téléphone | Toi, avec moi |

## Les étapes, dans l'ordre

### Étape 1 : mettre en ligne ce qui est prêt (moi, 1 jour)

- [ ] Relire et valider la landing et les écrans sur l'aperçu Vercel.
- [ ] Fusionner `feat/sprint-0-fondations` dans `main`, vérifier la CI et le déploiement.
- [ ] Vérifier en production `robots.txt`, `sitemap.xml` et l'image de partage.

**Terminé quand :** la nouvelle landing est en ligne, CI verte. Les inscriptions restent sur liste.

### Étape 2 : sécuriser les comptes (toi et moi, 1 à 2 jours)

- [ ] Ranger `~/.tartan/cle-sauvegarde.txt` dans ton gestionnaire de mots de passe.
- [ ] Passer `BLOB_READ_WRITE_TOKEN` en variable sensible sur Vercel : il est signalé lisible, et partagé entre production, preview et développement.
- [ ] Vérifier que les previews n'utilisent ni la base ni les clés de production. Valeurs masquées, je n'ai pas pu le contrôler.
- [ ] Confirmer que l'offre Vercel autorise un usage commercial. L'API ne me donne pas l'offre. Le déploiement avec une tâche horaire le laisse penser, sans le prouver : l'offre gratuite Hobby n'autorise pas l'usage commercial.
- [ ] E-mails : `yodev.fr` envoie avec DKIM et DMARC en place. **`tartan.coach` n'a pas de DMARC** : à ajouter chez OVH. Reste à vérifier que `EMAIL_FROM` utilise bien `yodev.fr` (valeur masquée) et que `hello@tartan.coach` reçoit bien.
- [x] Surveillance de `/api/health` et du site toutes les 15 minutes, par `.github/workflows/surveillance.yml`. Un échec déclenche l'alerte de GitHub. Coupure simulée : à faire une fois en ligne.

**Terminé quand :** chaque case est cochée, et une coupure simulée déclenche une alerte.

### Étape 3 : les essais réels (toi et ton frère, 1 semaine, lance le pilote)

- [ ] Parcours complets de `docs/recette-pilote.md`, § 1 et 2.
- [ ] Rouge en plein soleil, à la piste.
- [ ] Analyse vidéo avec un vrai saut filmé : l'écran a été revu avec une vidéo de test, pas avec un vrai ralenti.
- [ ] L'adresse de ton frère dans `COACH_SIGNUP_EMAILS`, puis le groupe invité.

**Terminé quand :** un athlète réel valide une séance en moins de 10 secondes et le coach le voit.

### Étape 4 : les corrections trouvées et les écarts connus (moi, 2 à 4 jours)

- [ ] Corriger ce que les essais réels ont montré.
- [x] Repères trop serrés de l'analyse vidéo : ils se regroupent, avec au moins 28 px entre deux boutons. Testé, et vu avec une vraie vidéo de test.
- [x] Parcours hors ligne « au stade sans réseau » : en mode dev, les fichiers de la page ne sont pas gardés hors ligne, elle ne s'hydrate donc pas. Limite du développement seulement, constatée sur la trace. Le test est réservé au build de production, comme en CI.
- [x] Offre payante, impayé, résiliation et retour de paiement revus à l'écran avec des données fictives. Corrigé : majuscule des dates, et plus de « Jusqu'au… » pendant un impayé. Le vrai retour de Stripe reste à voir avec le vrai paiement.
- [x] `pnpm db:seed` lit `apps/web/.env` et fonctionne sans variable à fournir à la main.

### Étape 5 : le juridique et la vente (toi, 2 à 4 semaines, à lancer dès maintenant)

- [ ] Juriste : les 8 questions de `docs/conformite.md`.
- [ ] Contrats de sous-traitance (DPA) de la liste de `docs/conformite.md`.
- [ ] Adhésion au médiateur (CM2C recommandé).
- [ ] Recherche de marque, `tartancoach.com` et `.fr`.
- [ ] 10 à 20 coachs interrogés sur le prix.
- [ ] Vrai paiement remboursé : prix, 14 jours d'essai, facture, `/abonnement`, résiliation.
- [ ] Carte Mux et Neon Launch.

**Terminé quand :** l'avis du juriste est écrit et ses demandes sont intégrées au code et aux textes.

### Étape 6 : l'ouverture (toi et moi, 1 jour)

- [ ] Répétition complète sur production avec un compte neuf : landing, création d'espace, invitation, séance, validation, paiement, résiliation, suppression du compte.
- [ ] Ton feu vert, puis `COACH_SIGNUP_MODE=public`.
- [ ] Surveillance rapprochée pendant 72 h : Sentry, webhooks Stripe, livraison des e-mails, capacité Mux et Neon.

**Terminé quand :** un coach inconnu crée son espace et invite son groupe sans aide.

## En parallèle : les apps mobiles

Ce suivi ne bloque pas l'ouverture web.

| Étape                                          | Qui            | État                                            |
| ---------------------------------------------- | -------------- | ----------------------------------------------- |
| Première compilation iOS, TestFlight           | Toi, moi       | App ID et fiche créés, reste ta connexion Apple |
| Compte Play Console, Firebase                  | Toi            | Pas commencé                                    |
| Essai sur vrais appareils, VoiceOver, TalkBack | Toi, moi       | Vérifié sur simulateur iOS seulement            |
| Compte de démonstration en production          | Moi            | Script prêt, à jouer                            |
| RevenueCat, achats intégrés                    | Toi, moi       | Code prévu, comptes à créer                     |
| Test fermé Google : 12 testeurs, 14 jours      | Toi, ton frère | Pas commencé                                    |
| Soumission aux stores                          | Toi, moi       | Après tout ce qui précède                       |

## Ce que j'attends de toi d'abord

1. Prendre rendez-vous avec le juriste : c'est le délai le plus long, et il peut changer le code (hébergement vidéo, suppression des données).
2. Faire l'adhésion au médiateur.
3. Relire la landing sur l'aperçu.
4. Ranger la clé de sauvegarde.

## Hors périmètre de l'ouverture

La V2 et la V3 du § 10 attendent les retours du pilote. Google et Apple ne sont pas configurés pour la connexion web : le lien magique suffit pour ouvrir, ce confort peut venir après.
