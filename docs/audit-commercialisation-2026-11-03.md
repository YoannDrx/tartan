# Tartan — audit fonctionnel, produit et commercialisation

Relevé du **3 novembre 2026**, sur `514c181bf4bde1342031238e0157b3139739ba59`. Ce rapport décrit l'état observé ; il ne reprend pas comme actuels les défauts historiques de `etat-des-lieux-et-plan.md`.

## Verdict

**Le cœur web est utilisable pour un pilote accompagné. L'ouverture commerciale autonome et la distribution iOS + Android ne sont pas validées.** Plusieurs défauts ont été reproduits malgré une suite existante verte. Aucun pourcentage de finition ne serait fiable : la valeur dépend de parcours qui doivent fonctionner ensemble, et pas du nombre d'écrans développés.

La promesse est pertinente : publier une séance, proposer la version club ou autonomie, voir qui l'a faite, analyser les sauts. La priorité est la fiabilité de cette boucle, puis la facilité du premier usage et de l'exploitation. Ajouter davantage de modules maintenant ne résoudrait pas les blocages constatés.

Le cahier v1.5, page 23 (§ 8), distingue un pilote gratuit de six semaines, une V2 d'ouverture et une V3 d'extension. L'objectif commercial demandé va au-delà de la validation du pilote. Cela ne rend pas automatiquement nécessaires les montres, le chat libre ou tous les modules V3.

## 1. Défauts confirmés et points bloquants

### P1 — Les notifications peuvent disparaître sans être livrées

**Reproduit sur la base locale, prestataires simulés, aucun message envoyé.**

- `apps/web/src/server/notify.service.ts:161` : une erreur web push 503 est considérée comme un résultat exploitable ; la notification reçoit ensuite `sentAt` au lieu de rester à réessayer.
- `apps/web/src/server/notify.service.ts:89` : `sendExpo` vérifie uniquement le statut HTTP. Une réponse HTTP 200 contenant un ticket `status: error` est traitée comme un succès. La reproduction utilise `MessageRateExceeded`.
- À la lecture, les échecs du repli e-mail sont aussi absorbés sans alimenter la liste des notifications à réessayer. Un appareil devenu invalide peut supprimer le repli e-mail du message en cours, car ce repli se base sur la liste d'appareils avant nettoyage.

**Impact :** un athlète peut ne jamais recevoir sa séance et le système la croire envoyée. C'est un blocage direct pour remplacer les SMS.

**À livrer :** résultats par destinataire/canal, distinction succès/erreur temporaire/jeton invalide, nouvelles tentatives bornées, lecture des tickets et receipts Expo, repli e-mail explicite, suivi des échecs dans l'administration. Un accusé du prestataire ne prouve pas à lui seul une réception sur le téléphone. [Documentation Expo](https://docs.expo.dev/push-notifications/sending-notifications/).

### P1 — Un ancien événement Stripe peut réactiver une offre résiliée

**Reproduit.** Pour le même abonnement, traiter d'abord l'événement `canceled`, puis un événement `active` plus ancien mais doté d'un autre identifiant, remet l'organisation sur Coach. La déduplication par identifiant n'empêche pas ce cas.

Référence : `apps/web/src/server/billing.service.ts:263`. Le contrôle `stale` ne protège que certaines résiliations d'un autre abonnement. L'ordre de réception n'est pas garanti par Stripe. [Documentation des webhooks](https://docs.stripe.com/webhooks).

**À livrer :** une synchronisation avec l'état autoritaire Stripe, protégée contre les traitements concurrents ; des tests désordre, doublons, remplacement d'abonnement et reprise après panne. Le même examen doit couvrir RevenueCat si ce canal est ouvert. Examiner aussi deux Checkout démarrés avant le premier webhook : le garde-fou actuel porte sur un abonnement déjà connu en base, pas sur une session de paiement en attente.

### P1 — La capacité vidéo contredit l'offre vendue

**Vu sur Vercel et dans le code.** `MUX_VIDEO_LIMIT=10` en production. `video-capacity.service.ts` compte les vidéos de tous les espaces et les médias téléversés de la bibliothèque. Ce n'est ni dix vidéos par coach, ni dix vidéos par mois.

Les CGV promettent 100 vidéos/mois pour Coach et 500 pour Club (`apps/web/app/(public)/cgv/page.tsx:23`). Quelques utilisateurs suffisent donc à bloquer l'ensemble de l'application.

**À livrer :** capacité Mux adaptée, vérification de l'offre et des coûts, retrait du plafond seulement après confirmation de la capacité, quotas par espace et alertes de consommation. L'étirement du ralenti augmente les minutes stockées : chiffrer une semaine réelle de sauts avant de promettre de grands volumes.

### P1 avant la sortie native — Les liens universels ne sont pas configurés

**Vu dans les réponses HTTP de production**, pas seulement dans les exemples du dépôt :

- `/.well-known/apple-app-site-association` contient `TEAMID.coach.tartan.app`, alors que l'équipe du build est `G9WFV7HNV6`.
- `/.well-known/assetlinks.json` contient une liste d'empreintes vide.

Références : `apps/web/app/.well-known/apple-app-site-association/route.ts:5` et `apps/web/app/.well-known/assetlinks.json/route.ts:5`.

**Impact :** invitations et liens de séance ne peuvent pas être considérés comme correctement associés aux apps installées. Les tests actuels vérifient surtout que les fichiers sont servis, ce qui laisse passer ces valeurs incomplètes.

**À livrer :** paramètres réels, vérification du contenu servi sur les deux domaines, essai après installation depuis TestFlight et une piste Google Play. Vérifier aussi les liens magiques et le retour au bon espace quand un utilisateur a plusieurs rôles.

### P2 — Renommer un exercice Instagram sur mobile supprime son média

**Reproduit sur un exercice privé.** Le formulaire natif ne réhydrate que YouTube ; pour Instagram, l'URL reste vide. Enregistrer un simple changement de nom produit `media: null`, puis le service supprime le média externe.

Références : `apps/mobile/app/exercise/[id].tsx:28`, `apps/mobile/src/lib/exercise-form.ts:76`, `apps/web/src/server/exercise.service.ts:127`.

**À livrer :** préserver les médias non édités, prendre en charge Instagram dans le formulaire ou expliquer explicitement ses limites. Une modification de titre ne doit jamais supprimer une vidéo implicitement.

### P2 — Le guide de premier démarrage coach est inaccessible dans un espace neuf

**Reproduit.** `suivi/page.tsx:50` exige que tous les exercices soient communs pour afficher le guide. Or `createOrganization`, dans `org.service.ts:61`, crée la bibliothèque de départ comme exercices propres à l'espace. Le critère est déjà faux avant que le coach ait fait quoi que ce soit.

**À livrer :** déterminer l'avancement à partir des actions utiles : athlète invité, séance publiée, première validation reçue. Garder un guide court et progressif jusqu'à l'obtention de ces résultats.

### Avant la vente — Promesses et textes à finaliser

Les CGV affichent encore un médiateur `[À DÉFINIR]` et décrivent un achat intégré mobile qui n'est pas opérationnel. Le dossier `docs/conformite.md` contient des questions encore ouvertes sur santé, mineurs, vidéo, cache hors ligne, sous-traitants et contenus tiers. Ce rapport ne tranche pas ces questions juridiques ; il constate qu'elles ne sont pas closes.

Le cache web du coach conserve des pages de suivi contenant des informations sensibles. Il faut fixer et tester la durée, la purge, le changement d'utilisateur et le retrait du consentement, au-delà du simple refus côté serveur. Les données déjà présentes hors ligne ne disparaissent pas automatiquement quand un consentement change à distance.

## 2. État des fonctionnalités

« Vérifié » ci-dessous désigne les scénarios effectivement contrôlés, et non une garantie pour toutes les combinaisons possibles. Les tests navigateur désactivent les vrais envois e-mail/Mux ; la vérification d'adresse y est remplacée par une écriture dans la base locale.

| Fonction                    | Ce qui existe                                                                                                           | État et limite restante                                                                                                                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connexion et compte         | Lien magique, mot de passe, confirmation e-mail, réinitialisation, passkeys, code OAuth                                 | Parcours locaux et règles d'accès testés. Distribution réelle des e-mails à éprouver. Variables OAuth Apple/Google absentes de Vercel ; boutons masqués. Passkeys non éprouvées sur appareils pendant cet audit.                          |
| Espaces et équipes          | Organisations, groupes, rôles, adjoints, sélection d'espace, logo                                                       | Services et contrôles d'accès présents et testés. Premier démarrage défectueux. Vérifier un vrai compte multi-rôle/multi-espace.                                                                                                          |
| Invitations                 | Lien, QR code, invitation personnelle, consentements, accord parental et relance                                        | Parcours navigateur couverts, dont moins de 15 ans. Réception parentale et ouverture dans les apps installées non validées.                                                                                                               |
| Fiche athlète               | Groupes, objectifs, particularités, blessures, force, performances, notes coach                                         | Implémentée ; contrôles de visibilité/consentement testés. Pas de validation exhaustive de chaque champ sur mobile. Revoir les opérations de changement de groupe et départ/transfert.                                                    |
| Bibliothèque                | Exercices privés, bibliothèque de départ, 24 références communes YouTube/Instagram, vidéos coach, recherche, catégories | Lecture commune et interdiction de modification couvertes. Défaut Instagram natif confirmé ; disponibilité durable des sources externes non garantie.                                                                                     |
| Construction de séance      | Blocs, prescriptions, club/autonomie, modèle, brouillon, programmation, destinataires, adaptations                      | Parcours web de création/publication et bascule autonomie passent. Formulaire dense ; compléter les essais mobiles avec un coach novice et de vraies séances.                                                                             |
| Calendrier                  | Semaine/mois, navigation, déplacement, duplication et modèles                                                           | Implémenté ; pas de recette exhaustive de tous les gestes/date/zone horaire pendant cet audit. La planification de saison reste un sujet V2.                                                                                              |
| Suivi coach                 | Grille athlètes × séances, statuts, appel, alertes, export CSV                                                          | Boucle principale testée. Les notifications d'alerte ne sont pas fiables en cas d'échec prestataire. Tester lisibilité/temps de réponse avec un groupe conséquent.                                                                        |
| Aujourd'hui athlète         | Séance du jour, présence, version adaptée, validation rapide, état de la semaine                                        | Parcours navigateur réussis. L'état validé est clair. Mesurer les dix secondes avec de vrais utilisateurs, pas à partir du nom d'un test automatique.                                                                                     |
| Mode séance                 | Exercices, séries, consignes, vidéos, validation                                                                        | Parcours web tactiles couverts. Ajouter une recette téléphone : interruptions, écran verrouillé, retour à la bonne étape, gros caractères.                                                                                                |
| Hors ligne                  | Cache web, file d'opérations, reprise ; persistance native et file locale                                               | Validation athlète et appel coach passent en Chromium et WebKit. Le web athlète prépare sept jours ; le coach prépare les séances du jour. Stockage saturé, arrêt de l'app, appareil partagé et révocation à distance restent à éprouver. |
| Analyse vidéo               | Import/capture, transformation des ralentis, lecture image par image, annotations, phases, partage                      | Beaucoup de code et de tests ; aucune nouvelle vidéo réelle de production testée ici. Essais iPhone/Android, arrière-plan et gros fichiers nécessaires. Plafond Mux bloquant.                                                             |
| Saut en hauteur             | Essais, hauteurs, feuille de barres, rattachement aux vidéos                                                            | Implémenté. À valider lors d'une séance complète à la piste. Dessin/comparaison simultanée ne sont pas requis pour le pilote V1.                                                                                                          |
| Communication               | Annonces, commentaires contextualisés, signalements et modération, blocage                                              | Services et scénarios couverts. Organiser concrètement qui répond aux signalements et au support.                                                                                                                                         |
| Notifications               | Push web/natif, e-mail de repli, heures calmes, regroupement, rappels                                                   | **Partiel : défauts reproduits.** Aucun appareil enregistré en production à l'instant du contrôle.                                                                                                                                        |
| Progrès                     | Historique, statistiques, indicateurs d'usage, satisfaction                                                             | Présent ; contenu utile à valider avec les athlètes. Pas de prédiction médicale à ajouter. Charge avancée et module sprint : prioriser après retours.                                                                                     |
| Réglages et confidentialité | Profil, logo, consentements, export, suppression, membres, paramètres d'espace                                          | Présents ; suppression et contrôles d'accès testés. Vérifier l'effacement effectif chez chaque prestataire, la reprise après échec et les règles de conservation.                                                                         |
| Facturation et parrainage   | Découverte/Coach/Club, essai, Checkout, portail, quotas, résiliation, récompenses                                       | Tests de logique et configuration réelle présents. **Pas validé commercialement** : désordre webhook, circuit réel non joué, remboursements/litiges et concurrence à compléter.                                                           |
| Administration              | Organisations, métriques pilote, satisfaction, gestion des signalements                                                 | Présente ; accès restreint. Ajouter/compléter une vision opérationnelle des échecs d'envoi, traitements en attente, quotas et réconciliation des paiements.                                                                               |
| Apps natives                | Expo iOS/Android, caméra, uploads, notifications, files hors ligne, tests Maestro préparés                              | Un build iOS production terminé ; aucun Android dans la liste EAS. Tests Maestro non exécutés dans cet audit. Publication/TestFlight/Play Console non certifiées.                                                                         |

## 3. Services et configuration réelle

| Service                     | Contrôle du 3 novembre                                                                                                                                                       | Conclusion                                                                                                                                                                                                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub                      | Aucune PR ouverte. HEAD, `origin/main` et `origin/feat/sprint-0-fondations` sur `514c181`                                                                                    | Rien à fusionner. Les anciens changements locaux signalés dans le précédent audit sont désormais intégrés.                                                                                                                                                                                               |
| CI                          | [Run du commit courant](https://github.com/YoannDrx/tartan/actions/runs/41662392312) réussi                                                                                  | Lint, typage, tests et contrôle design passent. Quatre avertissements lint. Le test vidéo séparé a nécessité une nouvelle tentative après une attente de connexion ; ne pas le présenter comme parfaitement stable.                                                                                      |
| Vercel                      | [Production](https://vercel.com/yoanndrxs-projects/tartan/DAfs11nP3KJE6NYXuQb73UEDkrZ3) READY au commit `514c181` ; domaines accessibles ; `/api/health` répond 200          | Web et base répondent. Région de fonctions déclarée Francfort. Le réglage de projet indique Node 26, le package web demande Node 22 : harmoniser et vérifier la version effective du build.                                                                                                              |
| Journaux Vercel             | Groupe remonté : avertissement `pg-connection-string` sur la sémantique future du mode SSL                                                                                   | Ce n'est pas une preuve de panne du cron. Rendre le mode SSL explicite avant une montée majeure du pilote. Les journaux consultés ne constituent pas un test de charge.                                                                                                                                  |
| Variables Vercel            | Métadonnées vérifiées via CLI après refus 403 du connecteur. Clés Stripe, Mux, base, VAPID et Resend présentes en production                                                 | Les variables `sensitive` ne sont pas relisibles : leur présence ne prouve pas leur validité. L'isolation exacte des secrets DB/Mux/Stripe entre preview et production reste à confirmer.                                                                                                                |
| Blob                        | Le même `BLOB_READ_WRITE_TOKEN` est associé à production, preview et développement ; type `encrypted` et relisible                                                           | Séparer les stockages/jetons et rendre la variable sensible. Pas de preuve d'une fuite, mais les environnements ne sont pas isolés sur ce service.                                                                                                                                                       |
| Stripe                      | Compte Tartan ciblé, quatre prix live actifs : 19/190 € Coach, 59/590 € Club. Webhook actif, trois événements d'abonnement, version `2025-03-31.basil`                       | Configuration structurée présente. L'activation paiements/virements avait été constatée précédemment ; sa relecture actuelle avec la clé restreinte retourne 403, elle n'est pas re-certifiée ici.                                                                                                       |
| Portail Stripe              | Actif, factures et moyen de paiement accessibles, changement de prix, résiliation en fin de période, pas de changement de quantité                                           | Cohérent. Le portail termine l'essai lors d'un changement d'offre : vérifier et expliquer ce comportement dans la recette.                                                                                                                                                                               |
| Facturation de bout en bout | Zéro abonnement fournisseur Stripe dans la base de production                                                                                                                | Aucune preuve actuelle du parcours paiement → droits → facture → résiliation. Le webhook ne traite pas les événements de remboursement/litige ; définir le traitement voulu et sa surveillance avant ouverture.                                                                                          |
| Mux                         | Toutes les familles de variables sont présentes, plafond global 10 confirmé                                                                                                  | Préparer la capacité commerciale, vérifier un upload complet et la lecture signée en production. La présence des clés ne remplace pas cet essai.                                                                                                                                                         |
| Neon                        | Projet `tartan`, Francfort, Postgres 17 ; branches production et preview distinctes ; env. 34,7 Mo logiques en production ; plafond 1 Gio, 0,25 CU ; historique 6 h          | Pas de saturation constatée. Capacité, restauration et protection de branche à adapter à la vente. La présence d'une branche preview ne prouve pas que Vercel y pointe.                                                                                                                                  |
| Migrations                  | 11 migrations terminées en production, 11 fichiers SQL dans le dépôt                                                                                                         | Nombre cohérent ; ne remplace pas une comparaison complète des checksums ni un exercice de migration/retour arrière.                                                                                                                                                                                     |
| Sauvegarde                  | Dernier workflow consulté réussi ; sauvegarde chiffrée quotidienne, rétention 30 jours ; restauration documentée le 2 novembre                                               | Bon socle. Copie externe de la clé privée non vérifiée. Nouvelle restauration non rejouée ici. La sauvegarde SQL ne contient pas les vidéos Mux.                                                                                                                                                         |
| E-mails et DNS              | Clé Resend présente seulement en production. DMARC `tartan.coach` en observation et `yodev.fr` en quarantine                                                                 | Réception réelle, délivrabilité, SPF/DKIM complets et valeur effective de l'expéditeur non revalidés. Aucun e-mail envoyé pour cet audit.                                                                                                                                                                |
| Sentry et surveillance      | DSN web présent ; nettoyage des événements dans le code ; workflow HTTP et dernier run consulté réussis                                                                      | Provoquer un incident contrôlé et vérifier la réception d'une alerte. Aucune preuve d'alerte native ni de surveillance complète des webhooks/notifications.                                                                                                                                              |
| Apple/EAS                   | [Build iOS 9](https://expo.dev/accounts/yoanndrx/projects/tartan/builds/39837912-1e4b-4a3d-992d-43f2ea5bab04) FINISHED, bundle `coach.tartan.app`, code rattaché à `69b6e68` | Recompiler le code courant : la bibliothèque native a changé depuis. Statut TestFlight/App Store Connect non contrôlé dans cet audit.                                                                                                                                                                    |
| Google/Android              | Aucun build Android dans EAS ; configuration prévue pour Firebase et service account, sans preuve de leur présence distante                                                  | Compte Play, identité/DUNS selon le type choisi, FCM, signature, build et piste de test à finaliser/vérifier. Les 12 testeurs pendant 14 jours concernent les comptes personnels récents, pas tous les comptes. [Règle Google](https://support.google.com/googleplay/android-developer/answer/14151465). |
| CI mobile                   | `EAS_ENABLED` absent et `EXPO_TOKEN` absent des listes GitHub consultées                                                                                                     | Le job mobile est ignoré. Les tests JS mobiles verts ne sont pas des builds iOS/Android ni des essais de l'app native.                                                                                                                                                                                   |
| Secrets locaux              | `.env.local` racine contient une clé live, est ignoré par Git et en 0600. Pas de clé Stripe dans `apps/web/.env`                                                             | La clé racine n'est pas automatiquement chargée par Next lancé dans `apps/web`. Utiliser un environnement local de test explicite ; ne pas exposer une clé serveur dans Expo. Le `.env` web contenant des secrets était en 0644 : permissions resserrées en 0600 pendant l'audit.                        |

Autre observation : le navigateur a signalé l'échec de chargement du script Vercel Web Analytics sur la landing de production. La cause n'a pas été déterminée (configuration ou blocage dans ce contexte de navigation). Ne pas considérer cette mesure d'audience comme validée ; les métriques métier en base sont distinctes.

Point fiscal : le code porte la mention de franchise de TVA, et `STRIPE_TAX_ENABLED` vaut false par défaut. Revalider la situation au moment de vendre ; la présence de Stripe Tax ou d'un champ d'identifiant fiscal ne suffit pas à établir le bon traitement. Aucune règle fiscale ni collecte automatique modifiée ici.

## 4. Expérience d'utilisation : ce qui aide et ce qui freine

Revue visuelle du site en production, puis des écrans Suivi, construction de séance et Aujourd'hui sur une base locale avec des données fictives. Les captures sont dans `docs/audit-2026-11-03/`. Ce n'est pas une nouvelle passe complète de tous les écrans ni une observation d'utilisateurs réels.

### Ce qui fonctionne dans la direction actuelle

- Identité reconnaissable, vocabulaire sportif, actions lisibles et état « Fait » clair.
- L'athlète arrive sur son besoin du jour ; les réglages restent secondaires.
- La grille répond directement à la question du coach. Les variantes club/autonomie constituent un bénéfice distinctif.
- Le site permet d'essayer la validation et l'appel avant de s'inscrire, sans raconter une application abstraite.
- Les commentaires restent attachés à une séance ou une vidéo ; cela évite de recréer un groupe de messages illisible.

### Ce que je prioriserais pour donner envie de revenir

1. **Premier résultat en quelques minutes.** Réparer le guide puis proposer une séance modèle pertinente, la publication et le lien d'invitation dans le même parcours. Afficher un avancement fondé sur la première séance réellement validée, pas uniquement sur des formulaires remplis.
2. **Création de séance plus progressive.** Le constructeur expose beaucoup d'informations et de commandes simultanément. Garder titre/date/groupe/contenu au premier plan ; révéler les adaptations et options ensuite. Donner un aperçu « ce que verra Léa ». Clarifier publier maintenant / programmer / brouillon / modèle.
3. **Reconnaissance des exercices.** Les filtres par pictogramme seuls demandent de connaître les catégories. Ajouter des libellés visibles au moins au premier usage et conserver recherche/favoris/récents si les observations montrent un gain. Prévoir un lien de secours quand une vidéo tierce disparaît ou refuse l'intégration.
4. **État fiable après chaque action.** Dire clairement enregistré sur l'appareil, en attente, reçu par le serveur, erreur et réessayer. Ne jamais donner le sentiment d'une validation ou d'une notification acquise alors qu'elle est perdue.
5. **Aujourd'hui encore plus contextuel.** Après validation, proposer « Revoir la séance » plutôt que « Démarrer la séance ». Donner un repos clair les jours sans séance. Permettre de corriger une validation erronée facilement. Le retour coach devrait être perceptible sans multiplier les notifications.
6. **Coaching sur téléphone.** Rendre l'accès au groupe et à l'appel aussi évident que sur ordinateur ; mesurer les actions à une main. Tester les gros caractères et le clavier ouvert. Réduire la place des titres si cela repousse les actions utiles sous l'écran.
7. **Progression compréhensible.** Montrer régularité, séances accomplies et évolution des performances pertinentes, avec les mots du coach. Éviter d'ajouter des scores pseudo-médicaux ou des mécanismes de compétition culpabilisants pour les mineurs.
8. **Support accessible.** Une aide contextuelle courte, un contact visible dans l'app et un diagnostic technique sans données sensibles peuvent éviter qu'un coach retourne aux SMS au premier blocage.

Ces propositions sont des recommandations produit. Elles ne sont pas toutes des fonctionnalités manquantes du cahier ni toutes nécessaires pour la première version payante. Les priorités 1, 2, 4 et 6 ont le lien le plus direct avec l'adoption.

## 5. Validation exécutée et limites

- `pnpm test` via Corepack, bases locales explicitement désignées : **286 tests réussis** — 51 domaine, 79 mobile, 156 web.
- `E2E_PROD=1 pnpm test:e2e` : **34 réussis, 10 ignorés**, sur build de production local. Huit cas dupliqués sont réservés au projet desktop et deux sont le test vidéo exécuté séparément en CI. Les huit cas terrain Chromium/WebKit passent.
- CI du commit courant : typage, lint, contrôle design verts ; quatre avertissements lint. Cinq tests de transformation vidéo natifs sont ignorés dans la CI mais passent localement. Le PoC vidéo séparé est passé au second essai après une erreur d'attente de connexion.
- Cinq reproductions ajoutées temporairement : **cinq échecs correspondant aux défauts décrits** — onboarding, Instagram, Stripe désordonné, push web 503, ticket Expo en erreur. Leur source et leur sortie sont conservées à part, sans ajouter de tests rouges à la suite normale.
- Environnement local : Node 24.9.0, pnpm 10.34.9. La CI suit `.nvmrc` ; les résultats locaux ne certifient pas toutes les versions Node possibles.
- Lecture des métadonnées Vercel, Stripe et EAS, du projet/branches Neon, de DNS et de réponses HTTP ; agrégats SQL uniquement en production, sans modification de données.
- Aucune charge financière, aucun message envoyé, aucune modification de configuration cloud ni déploiement effectués pendant cet audit.

**Non exécuté :** nouvelle installation native sur appareils physiques, achat réel, réception d'e-mail/push sur appareils, upload Mux réel complet, tests de charge, nouveau test de restauration, examen juridique, audit de sécurité externe. Pas de preuve d'un pilote actif : la production compte 1 compte hors démonstration, 11 comptes de démonstration, 11 fiches athlètes, 0 vidéo d'athlète, 0 appareil et 0 abonnement Stripe dans la base.

Pour rejouer les reproductions, copier temporairement `docs/audit-2026-11-03/reproductions.test.ts.txt` vers `apps/web/tests/audit-release-repro.test.ts`, démarrer Postgres local puis lancer :

```sh
TEST_DATABASE_URL=postgresql://tartan@localhost:54329/tartan_test \
DATABASE_URL_UNPOOLED=postgresql://tartan@localhost:54329/tartan_test \
STRIPE_PRICE_COACH_MONTH=price_audit_coach \
NEXT_PUBLIC_VAPID_PUBLIC_KEY=audit-public \
VAPID_PRIVATE_KEY=audit-private \
corepack pnpm --filter @tartan/web exec vitest run tests/audit-release-repro.test.ts
```

Cette commande remet à zéro **la base locale de test**. Retirer ensuite uniquement la copie temporaire. Les prestataires des reproductions sont simulés.

## 6. Plan de finition avec critères de sortie

| Lot                | Travail                                                                                                                                                       | Critère vérifiable                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| A — Fiabilité      | Corriger les cinq défauts reproduits ; couvrir concurrence Checkout, retraitements, échec e-mail ; examiner suppression chez les prestataires                 | Reproductions devenues tests de non-régression verts, suite existante verte, cas de panne explicables à l'utilisateur                 |
| B — Configuration  | Mux adapté, Blob isolé, isolation DB/Stripe/Mux prouvée, identifiants de liens réels, capacité/restauration Neon, alertes testées                             | Matrice des environnements vérifiée ; restauration sur base vide ; incident contrôlé reçu par le responsable                          |
| C — Expérience     | Premier démarrage, hiérarchie du constructeur, états de synchronisation, clarté des actions après validation                                                  | Un coach extérieur crée une séance et invite son groupe sans aide ; un athlète comprend quoi faire et valide en moins de dix secondes |
| D — Recette réelle | iPhone + Android, réseau coupé/rétabli, reprise upload, 120/240 i/s, push, lien magique, consentements, lecteur d'écran et soleil                             | Procès-verbal de chaque scénario, modèle/OS notés, aucune perte de validation ou de vidéo, aucun accès indu                           |
| E — Vente          | Paiement sandbox complet, puis recette réelle contrôlée ; essai, renouvellement, impayé, résiliation, facture, remboursement ; textes et décisions juridiques | Prix/droits/facture concordent ; opérations de support documentées ; aucune promesse légale/technique provisoire affichée             |
| F — Distribution   | Builds actuels iOS/Android, TestFlight/piste interne, FCM/APNs, fiches et confidentialité, compte de revue, règles d'achat retenues                           | Installation et parcours réussis sur chaque plateforme ; soumissions acceptées si une sortie simultanée est maintenue                 |
| G — Adoption       | Pilote de six semaines, retours hebdomadaires, correction des frictions                                                                                       | Cibles du cahier : >70 % de validation après quatre semaines, usage coach dans Tartan, abandon effectif des SMS                       |

**Définition proposée de « commercialisable » :** aucun défaut P1 ouvert, fonctions annoncées disponibles, livraison des notifications observable, paiement et résiliation éprouvés, récupération des données testée, règles de confidentialité et de support opérationnelles, et validation par des utilisateurs réels. Pour annoncer également iOS et Android : leurs parcours et leur distribution doivent avoir passé le lot F.

Les achats intégrés, parents, dessin vidéo, comparaison, saison et sprint appartiennent à l'ouverture V2 du cahier : décider lesquels sont nécessaires à l'offre réellement vendue. Les montres, le chat libre, la bibliothèque communautaire et les autres modules V3 peuvent attendre. La complétude doit porter sur la promesse vendue et tenue.

## 7. Ce qui a changé pendant cet audit

Rapport et preuves ajoutés dans `docs/`. Le fichier local `apps/web/.env` a été restreint en permissions 0600. Aucun correctif fonctionnel, commit, fusion, changement d'offre payante ou déploiement n'a été effectué. Aucune PR n'était ouverte. Les défauts exposés restent donc à corriger ; ce rapport ne les déclare pas résolus.
