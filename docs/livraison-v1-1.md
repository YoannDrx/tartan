# Livraison V1.1 — suivi d’exécution

Décision produit du 7 novembre 2026 : le plan « Tartan V1.1 — préparation physique pour l’athlétisme, en deux PR » transmis par le fondateur remplace les plans antérieurs. Les ajouts de progression, phases et planificateur sont explicitement autorisés. La PR 1 reste indépendante de la refonte et de l’IA ; la PR 2 comprend les lots A à E et conserve la parité native.

Ce document distingue le code livré, la configuration et les preuves réelles. Un test avec prestataire simulé ne vaut pas un essai Stripe, Resend, APNs ou FCM réel. Aucune ouverture commerciale ni publication store n’est effectuée par cette PR.

## État courant de la PR 2

Au 8 novembre 2026, après les lots constructeur, vidéo générique et profil sportif : PR #45 en brouillon, fonctionnalités de progression désactivées par défaut et non publiées en production. Les sections de preuves ci-dessous gardent l’historique des étapes ; les mentions « reste à faire » d’un ancien lot sont remplacées par les preuves plus récentes.

| Lot | État actuel | Reste principal |
| --- | --- | --- |
| A — positionnement et expérience | Socle visuel clair et constructeur natif implémentés ; reprise chiffrée, modification, sauvegarde et publication testées sur simulateur iOS ; suppression séances/modèles, vidéo générique, profil sportif web/native, 49 fiches initiales et publication groupée atomique ajoutés | Suite de la recette du constructeur, recette complète de l’onboarding, médias de bibliothèque, landing et recette physique |
| B — données réalisées | Références liées, prescriptions figées, saisie athlète/coach web/native, hors ligne et conflits, rapprochement historique et actualisation explicite des charges publiées implémentés | Recette native physique et validation globale |
| C — historique et records | Historique web/natif, API sécurisée, courbes de volumes et de force avec provenance, références séparées, rappel des séries comparables, calculateur, records de séries, célébration unique confirmée par le serveur et performances athlé typées avec correction web/native | Recette native et physique globale |
| D — phases et analyses | Phases web/native, choix du constructeur conservé/revalidé et référence figée par prescription ; analyse prévu/réalisé, couverture, courbes hebdomadaires de volumes et charge ressentie avec consentement, diversité, catégories et classement mouvement/matériel figé et intensités par exercice/unité avec couverture, filtres 4/12 semaines/un an/phase conservée avec fenêtre de dates ; période partagée séparée pour athlète/adjoint | Recette globale et physique |
| E — planificateur IA | Contrats stricts, validation métier, adaptateur OpenAI serveur et réservations de quotas atomiques ajoutés ; drapeau global désactivé, sans route ni interface | Persistance des propositions, clarifications incluses, dictée/transcription, brouillons, purge des textes et corpus d’évaluation |

Les recettes réelles Stripe/e-mails/push/vidéo, les configurations externes encore absentes, les démarches commerciales et juridiques et la publication stores restent ouvertes. Les preuves locales et exports Hermes ne les remplacent pas.

## PR 1 — état du code

**PR [#44](https://github.com/YoannDrx/tartan/pull/44) fusionnée et déployée en production le 7 novembre 2026.** Commit de fusion `98daa94862d23ccb28e71174d55761074d4adc3e`, code revu `5218ea1`. CI qualité et compilation Android de la PR réussies. Le déploiement Vercel `dpl_6oFeiXS1ux1XkWrj8pY8WvBfGRrU` est Ready et porte les domaines Tartan. La CI supplémentaire de main est réussie (run `42413864150`). Les configurations et recettes externes ci-dessous restent à compléter avant les jalons commerciaux correspondants. Aucun fichier d’audit personnel non suivi n’est inclus.

| Périmètre                                                                               | Codé                                                                                | Test automatique                                                                                                     | Configuration / essai réel                                          | Activation / publication            |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------- |
| Checkout persistant, bail atomique, paramètres figés, idempotence et changement d’offre | Oui                                                                                 | Concurrence réelle sur Postgres, réponse perdue, bail expiré, délai d’idempotence dépassé, reprise après résiliation | API sandbox éprouvée ; Checkout navigateur à jouer                  | Code déployé                   |
| Départ du payeur, commandes durables, fermeture des Checkout et isolation du portail    | Oui                                                                                 | Panne, reprise, réponse Checkout perdue avant transfert, portail interdit au repreneur                               | Reprise API sandbox éprouvée ; cycle payé à jouer                   | Code déployé                   |
| Anomalies de souscriptions vivantes                                                     | Oui                                                                                 | Plusieurs souscriptions dont une incomplète ; aucune annulation automatique                                          | Rapprochement opérateur à exercer                                   | Console protégée, code déployé |
| Conservation du choix d’offre                                                           | Parcours existant conservé ; lien magique expiré corrigé                            | Recette inscription / vérification à compléter                                                                       | À vérifier sur Preview                                              | Code déployé                   |
| Confirmation de date avant écriture                                                     | Web et native, âge/onboarding/invitation                                            | Parcours navigateur desktop/mobile, contrôle a11y ; déclaration concurrente                                          | iPhone/Android physiques à vérifier                                 | Code déployé                   |
| Rectification support de date                                                           | Oui, motif contrôlé, profil et fiches liés, audit sans date                         | Accès interdit hors administration et trace vérifiés                                                                 | Recette console à compléter                                         | Code déployé                   |
| Activité de l’espace indépendante du compte                                             | Oui, contributions métier ; publication cron et relance exclues                     | Espace actif protégé, timestamp cron sans effet                                                                      | Préavis aux coachs à vérifier sur boîte réelle                      | Code déployé                   |
| Outbox de facturation                                                                   | Échecs durables visibles, reprise explicite, message obsolète refusé                | Expiration, reprise et obsolescence                                                                                  | Réception réelle à vérifier                                         | Code déployé                   |
| Rebonds / plaintes                                                                      | Webhook Resend signé et liste d’exclusion par empreinte                             | Signature invalide, signature valide, rejeu                                                                          | `RESEND_WEBHOOK_SECRET` absent sur Vercel lors du contrôle          | Non raccordé                        |
| E-mails de suppression / reprise d’espace                                               | Écriture transactionnelle, reprise, contrôle du destinataire actuel et du transfert | Panne puis reprise, transfert obsolète et purge des contenus après 30 jours                                          | Réception réelle à vérifier                                         | À compléter                         |
| Sonde légère                                                                            | `/api/live` sans accès base ; `/api/health` conserve le contrôle DB                 | Typecheck / build                                                                                                    | Sonde externe à raccorder                                           | Non raccordée                       |
| Push et liens universels                                                                | Implémentation existante conservée                                                  | Tests natifs existants                                                                                               | APNs, FCM, appareils physiques et identités de signature à vérifier | Stores non publiés par ce travail   |

## Preuves locales

Environnement jetable : Postgres local port 54329, bases dédiées `tartan_v11_test`, `tartan_v11_e2e`, `tartan_v11_migration`. Les preuves ci-dessous ont été obtenues dans ces bases jetables. Le déploiement de production ultérieur est documenté en fin de fichier.

- Suites automatisées intégrales sur le code final : **597 tests verts** (395 serveur, 66 domaine, 136 mobile). Les cas financiers couvrent concurrence, réponse perdue, reprise après expiration du bail, changement d’offre et nouveau client Stripe après transfert.
- Les cas d’e-mail couvrent la reprise après suppression, le transfert devenu obsolète et la purge des contenus ; les cas d’âge couvrent aussi le refus persistant à l’onboarding et sur invitation.
- TypeScript : ensemble du monorepo vert.
- ESLint : zéro erreur, quatre avertissements préexistants sur React Hook Form et navigation.
- Impeccable / `design:check` : zéro travers.
- Campagne Playwright sur build de production : 44 tests passés, 10 ignorés et deux anciens tests d’âge à adapter au nouveau dialogue. Après adaptation, les deux tests d’âge et deux nouveaux tests de console administrateur passent (desktop/mobile, Axe et absence de débordement). Soit 48 scénarios passés sur la campagne et les reprises ciblées ; la suite complète n’a pas été relancée après cette dernière adaptation. Les deux nouveaux parcours de confirmation d’âge avaient déjà réussi dans la campagne complète.
- Après extension aux autres parcours d’âge : **16 tests navigateur réussis sur build de production**, incluant confirmation/correction à l’onboarding, console support, invitation refusée et parcours hors ligne Chromium/WebKit. La CI doit encore vérifier l’ensemble sur le dernier commit.
- CI du commit `3614f95` : **50 parcours de production réussis, 10 ignorés**, tests métier, lint, types et design verts. Le test vidéo séparé en développement échoue pendant l'attente de compilation suivant la connexion (15 s). Reproduction locale réussie ; le délai de navigation en développement est aligné sur les 60 s déjà accordées à l'onboarding, sans assouplir les 15 s de production. Nouvelle CI requise après ce correctif.
- Configuration Stripe : 11 tests ciblés réussis sur le script exigeant mode, compte attendu et origine explicites. La sandbox ne peut plus raccorder par défaut ses webhooks à la production ; un nouveau secret est écrit dans un fichier privé, jamais dans les logs. La sandbox dédiée `acct_1UXJsn7nmxxw9EFI` contient les quatre tarifs attendus mais aucun webhook lors du contrôle.
- Relecture avant fusion : reproduction rouge puis verte d'un Checkout terminé entre la lecture initiale du compte et le verrou du transfert. Les références Stripe sont maintenant relues dans la transaction, sous le verrou de l'espace, avant d'enregistrer les commandes durables. Le repreneur est aussi revalidé et verrouillé : une suspension concurrente annule le transfert au lieu de promouvoir ce membre. **22 tests ciblés** facturation/transfert/e-mails/exploitation et typecheck réussis après ces corrections ; nouvelle CI requise.
- Recette Stripe fournisseur du 7 novembre à 18 h 29 UTC : **2 scénarios réussis en 70,81 s**, compte sandbox dédié et base locale jetable. Concurrence, réutilisation, expiration avant changement d’offre, récupération de réponse perdue, transfert avec panne, reprise de l’arrêt à échéance, portail du partant interdit et nouveau client après clôture de l’ancien abonnement vérifiés. Les sessions encore ouvertes sont expirées et les clients créés sont supprimés avec confirmation. Transport CLI avec réponses Stripe réelles ; abonnement d’essai sans paiement. Le Checkout navigateur, le paiement, la facture payée, le webhook HTTP signé et les e-mails restent à éprouver. Harnais explicite et procédure dans `docs/stripe.md`, exclus de la CI ordinaire. Typecheck web et lint du harnais réussis.
- CI qualité complète du commit `dca35b0` : réussie (run `42400529150`), y compris la preuve vidéo en développement. La compilation Android du même commit reste en cours au moment de cette preuve.
- Migrations sur base vierge : appliquées par la préparation des suites.
- Migration sur ancien schéma synthétique : 21 migrations historiques, insertion d’un propriétaire, d’un client Stripe fictif et d’une séance ; application des trois migrations additives et vérification du payeur, de l’activité et de la conservation de la séance. Application des trois migrations : 0,09 s localement. Ce chiffre n’est pas une durée de migration de production.
- Première vérification complète lancée via un script récursif a employé le runtime de repli local ; les commandes directes suivantes utilisent Node 22.23.4 et Corepack/pnpm du dépôt. Les préparations Vitest/Playwright utilisent maintenant Corepack pour éviter le pnpm de repli.

## Configuration externe observée le 7 novembre 2026

Projet Vercel `tartan`, équipe `team_3XXL1abz5SsLVR9IW9gUU0Sv`, projet `prj_Tg2NrUya3YLeWmwdTlcI0QjYzAvT`. Lecture des métadonnées via CLI authentifiée ; le connecteur a refusé la liste des variables (403), le repli CLI a réussi. Aucune valeur secrète publiée.

- Au début du contrôle, `BLOB_READ_WRITE_TOKEN` ciblait simultanément Production, Preview et Development. Un seul store lié était observé : `tartan-images`, région `fra1`. Constat initial corrigé : jeton existant limité à Production, nouveaux stores `tartan-images-preview` (`store_eyKRDDe4JTtR2z9I`) et `tartan-images-development` (`store_xPJT88hYA2TnLspl`), chacun raccordé à son seul environnement. Test réel : trois jetons différents, upload Preview réussi, suppression de cet objet avec le jeton de production refusée, objet toujours présent, puis suppression avec le jeton Preview confirmée. Ces stores sont publics pour les images ; ce test prouve l’isolation des opérations authentifiées, pas une confidentialité des URL publiques. La CLI a aussi actualisé le jeton Blob de `.env.local` racine, en conservant les clés définies uniquement localement.
- Des entrées Production et Preview distinctes existent pour Neon, Stripe, Mux et VAPID. Leur simple présence ne prouve pas que leurs valeurs ou comptes sont différents.
- Le contrôle CLI doit ignorer les marqueurs `[sensitive]` : l’ancien script les comparait comme des secrets identiques. Il exige désormais le projet et l’équipe explicites, classe ces marqueurs comme illisibles et sort avec un code non nul si l’isolation n’est pas prouvée. Le partage initial du jeton Blob avait été confirmé par sa valeur réelle, sans la révéler ; l’égalité des marqueurs ne permet aucune conclusion sur Neon ou Stripe.
- La clé **publique** VAPID est identique entre Preview et production. La clé privée étant masquée, son égalité n’est pas démontrée ; vérifier et séparer la paire avant la recette push.
- Le script `vercel-migrate.mjs` migre uniquement la production. La branche Neon `preview` (`br-floral-sun-b9iar8ge`) était vide de tables applicatives. Les 24 migrations y ont été appliquées en 23,5 s. Un rôle dédié `tartan_preview_app`, limité à lecture/écriture dans `tartan.public`, a été créé ; lecture des 24 migrations et absence de comptes vérifiées. Les deux URL de base Vercel Preview ont été remplacées par les connexions de ce rôle (poolée/directe). La production n’a pas été migrée. Les migrations Preview suivantes restent une opération explicite avec le rôle propriétaire, hors du runtime applicatif.
- `APPLE_TEAM_ID`, `ANDROID_SHA256_FINGERPRINTS`, `CRON_HEARTBEAT_URL`, `CRON_HEARTBEAT_NOTIFICATIONS_URL` et `RESEND_WEBHOOK_SECRET` ne figurent pas dans cette liste.
- Preview Vercel du commit `3768b64` : `dpl_Fki3jMtjpyAgubhsRrQidzq3pGMF`, réponse HTTP 200 avec état synthétique `ok` sur `/api/live` et `/api/health`, contrôlée le 7 novembre à 17 h 31 UTC. Le second endpoint vérifie la connexion à Neon.
- Resend et Sentry sont configurés en production dans les métadonnées ; réception, sourcemaps et alertes ne sont pas validées par cette lecture.
- Protection Neon production demandée mais refusée (HTTP 422) : limite du nombre de branches protégées de l’offre actuelle. L’historique observé reste de 21 600 secondes (6 h) ; aucune montée en gamme effectuée. La [documentation actuelle](https://neon.com/docs/guides/protected-branches) réserve cette fonction aux plans payants (2 branches protégées en Launch, 5 en Scale) ; supprimer un autre projet gratuit ne donne pas accès à cette fonction.
- La sauvegarde quotidienne chiffrée sur 30 jours existe dans `.github/workflows/sauvegarde.yml`. La possession d’une copie de la clé hors du Mac et une nouvelle restauration chronométrée restent à prouver.
- Restauration réelle du 7 novembre, sauvegarde GitHub `42357874404` (source `1852b25`, créée à 09 h UTC) : déchiffrement puis restauration dans une nouvelle base locale isolée en **0,57 s** ; 57 tables, 21 migrations. Application des trois migrations de la PR : **0,82 s**, 60 tables et 24 migrations ; 12 comptes, 2 espaces et 60 séances conservés. Ces durées locales ne préjugent pas d'une restauration distante. Fichiers temporaires et base restaurée supprimés après vérification. La copie de la clé hors du Mac reste à attester.

## Procédures de recette et de retour arrière

1. Sauvegarder puis restaurer dans une base isolée avant la migration de production. Vérifier comptes, espaces, séances, fichiers et migrations. Chronométrer et noter le commit et l’environnement.
2. Appliquer les migrations additives avant le nouveau code. Ne pas retirer de colonnes en circulation. Vérifier les valeurs reprises (`billing_owner_id`, `last_business_activity_at`).
3. Sur la Preview isolée, jouer les cas de `billing-reliability.test.ts` contre Stripe sandbox, puis contrôler le portail et la facture. Ne pas lancer ces scénarios sur les clients de production.
4. Configurer le webhook Resend `/api/webhooks/resend` pour `email.bounced`, `email.complained`, `email.suppressed`, avec secret propre à l’environnement. Vérifier une livraison réelle et un événement de test signé. La liste d’exclusion locale ne se lève pas automatiquement.
5. Raccorder Better Stack à `/api/live` pour la disponibilité fréquente, `/api/health` à une cadence adaptée pour le contrôle DB, et les deux heartbeats aux tâches correspondantes. Simuler un échec et conserver la preuve de réception.
6. En cas de défaut applicatif, définir `BILLING_CHECKOUT_ENABLED=false` puis redéployer pour arrêter les nouvelles souscriptions sans couper le portail, les webhooks ou les commandes d’arrêt. Garder la base additive. Ne pas redéployer aveuglément l’ancienne logique Checkout pendant que des intentions ou commandes sont en attente : elle ignore leur verrou. Privilégier un correctif en avant, préserver la file puis reprendre après vérification.

### Rapprochement facturation

- Intention `review` : relever espace, intention, génération, date et session dans la console. Chercher l’opération Stripe avec la clé `checkout-{id}-{generation}` et les métadonnées de l’espace. Ne jamais remplacer une issue inconnue par une nouvelle clé après 24 h.
- Si la session existe : vérifier son client et son état, puis rattacher son identifiant à l’intention sous contrôle opérateur. Une session complète doit conduire à la réconciliation de l’abonnement ; une session ouverte doit être expirée avec confirmation avant toute nouvelle génération.
- Plusieurs souscriptions : vérifier chaque facture et moyen de paiement dans Stripe. La déduplication des webhooks ne justifie aucun remboursement. Les décisions financières nécessitent une vérification explicite.
- Commande d’arrêt en attente : contrôler le code d’erreur et l’état Stripe. La tâche reprend avec délai croissant. Une disparition de ligne d’outbox n’est jamais un moyen de résoudre une anomalie.
- E-mail en échec : la reprise console recontrôle destinataire et état métier. Un doublon reste possible si une réponse d’envoi s’est perdue au-delà de la fenêtre d’idempotence du prestataire ; la confirmation de reprise le précise. Ne pas rejouer un message obsolète.
- Espace actif sans repreneur : traiter la file support dans les 30 jours, organiser une reprise vérifiée, puis supprimer le compte inactif. Le mécanisme de protection ne clôt pas cette obligation de traitement.

## PR 2 — lots restant à implémenter

| Lot | Contenu autorisé                                                                                                                   | État                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| A   | Préparation physique athlé, DA de travail, onboarding, bibliothèque, vidéo générique, constructeur natif                           | Non commencé sur cette branche                                                                               |
| B   | Références liées aux exercices, identifiants stables, versions, charges résolues figées, séries réellement réalisées et hors ligne | En cours : références, gel, saisie athlète, validation rapide, conflits et brouillons web/natifs ; formulaires natifs de force ajoutés ; saisie coach, rapprochement historique et actualisation des prescriptions à poursuivre |
| C   | Historique, Epley, tableau des pourcentages, records comparables et célébration unique                                             | En cours : calcul Epley et pourcentages ; historique, records et interfaces à poursuivre                     |
| D   | Phases privées/partagées, progression et analyse avec provenance et couverture                                                     | Non commencé                                                                                                 |
| E   | Dictée web/native, clarifications, propositions contrôlées, quotas, confidentialité et corpus d’évaluation                         | Non commencé ; clé locale existante identifiée, réutilisation demandée par le fondateur                      |

Accès OpenAI : présence de `OPEN_AI_API_KEY` vérifiée dans le `.env.local` racine, sans afficher sa valeur. Le fondateur demande de réutiliser cette configuration ; aucune nouvelle création de clé n’est nécessaire pour commencer le lot E. Aucun appel OpenAI n’a encore été testé. Le branchement serveur, la compatibilité avec ce nom de variable et la vérification du remplacement de la clé anciennement exposée restent à traiter ; la présence locale seule ne prouve ni la validité de la clé ni sa rotation.

### Premier lot de progression — branche `codex/v1-1-progression`

PR en brouillon : [#45](https://github.com/YoannDrx/tartan/pull/45). Branche fondée provisoirement sur la PR 1, à cibler vers `main` après fusion de celle-ci. Migration additive, drapeaux progression/phases/IA désactivés par défaut ; aucune activation en production.

- Contrat détaillé : séries de travail/échauffement, charge externe/poids du corps/assistance, répétitions totales/par côté, distance, durée et contacts distincts.
- Versions de séance et de validation, auteur, snapshot de la prescription au premier enregistrement détaillé. Un maximum ultérieur ou le remplacement d'un exercice ne réécrit plus cette réalisation.
- Mutation persistante : le rejeu de A après une correction B ne remet pas A en place. Concurrence testée sur Postgres ; conflit HTTP 409 explicite. Une ancienne application ne peut ni modifier silencieusement une validation détaillée ni effacer les séries avec un tableau vide.
- Statistiques de volumes : uniquement les données réalisées renseignées, valeurs absentes à `null`, couverture explicite ; coefficient de 50 % et recalcul depuis les maxima récents retirés. La tendance n'utilise plus une ancienne semaine en guise de semaine courante manquante.
- Epley 2–10 répétitions, une répétition conservée ; pourcentages 40–100 % et arrondi au pas du matériel. Cibles RPE/RIR indépendantes des kilos.
- Vérification : **621 tests verts** (411 serveur, 74 domaine, 136 mobile), types du monorepo verts. La suite navigateur de ce lot reste à exécuter.

Ce lot ne termine pas le socle : le lien des maxima à la bibliothèque, le gel des références dès la prescription (actuellement au premier enregistrement détaillé), les interfaces de saisie web/natives restent à implémenter. L'API de saisie coach et sa lecture sont maintenant partagées avec les mêmes contrôles de version, auteur, espace et groupe ; 11 tests ciblés de progression et les types du monorepo passent après cet ajout. Les phases, records et le planificateur ne sont pas livrés par ce premier lot.

La fusion de la PR 2 exige les cinq lots compilables, testés et isolés par drapeaux. L’IA peut rester désactivée pour l’ouverture commerciale. Aucun écran incomplet, preuve simulée ou réglage absent ne doit être présenté comme publié.

Références prestataire utilisées pour le webhook : [vérification de la signature Resend](https://resend.com/docs/webhooks/verify-webhooks-requests), [distinction entre rebond permanent et temporaire](https://resend.com/changelog/email-bounce-details). Les rebonds temporaires ne créent pas d’exclusion définitive.

Preview Neon : la migration additive du premier lot a été appliquée le 7 novembre sur `br-floral-sun-b9iar8ge` en 4,16 s. Lecture via le rôle applicatif limité vérifiée : 25 migrations, aucune mutation de série, aucun espace activé pour la progression. Aucune migration exécutée en production.

### Identité des items et conflits d’édition

Les nouvelles références du constructeur web sont persistantes. Les anciennes séances conservent leurs références `b0-i0` lors de la première lecture puis de l’enregistrement modernisé ; elles ne sont pas réattribuées selon le nouvel ordre. Les adaptations suivent les items, y compris entre blocs. Une copie de modèle ou une version autonomie reçoit des références distinctes. Un exercice remplacé ne peut pas réutiliser l’identité d’un autre.

Les enregistrements comparent la version attendue sous verrou et incrémentent la version. Publication, déplacement de date et génération de l’autonomie invalident aussi un éditeur ouvert. Les anciens clients sont refusés avec un conflit explicite lorsqu’une séance a déjà des références persistantes ou des validations ; ils ne peuvent pas réécrire silencieusement les liens des séries.

Preuves locales du 7 novembre : **422 tests serveur**, **77 tests domaine** réussis ; **2 parcours navigateur sur build de production**, desktop et mobile, vérifient réordonnancement, réouverture, conflit entre deux onglets et sauvegarde suivante. Lint ciblé réussi. Ce lot ne crée pas encore le constructeur natif ni le gel des charges individuelles à la publication.

### API du constructeur et périmètre coach

Création de brouillons, lecture d’édition, mise à jour versionnée, suppression et publication séparée sont exposées dans l’API existante et le client partagé. Le web consomme le même contexte de constructeur : exercices, modèles, groupes et destinataires autorisés, sans notes privées ni santé. Une publication exige la version relue ; une modification concurrente impose une nouvelle relecture.

L’ouverture de ces écritures a aussi conduit à fermer une reprise de séance hors périmètre : un coach ne peut pas lire puis réattribuer à son groupe une séance d’un autre groupe. Les contrôles des athlètes et adaptations sont regroupés pour éviter une requête complète de périmètre pour chaque item.

Preuves : **88 tests ciblés** d’identité, accès et audience passent après le renforcement des contrôles ; **29 tests ciblés** de progression, identité et notifications passent après ajout du contrôle de publication. Les types de tous les packages, du web et du mobile passent. **Deux parcours HTTP sur build de production**, desktop/mobile, couvrent création privée, lecture des références, rejet sans version, conflit de mise à jour, refus de publication obsolète, publication explicite et suppression. Les deux parcours visuels de réordonnancement/conflit avaient aussi réussi avec le service de contexte commun. Lint : zéro erreur, quatre avertissements préexistants ; design : zéro travers.

Ces API préparent la parité native ; elles ne constituent pas encore l’écran natif du constructeur. La publication groupée et les API de phases/IA restent à implémenter. CI qualité de la PR 1 au commit `5218ea1` réussie (run `42401662041`) ; compilation Android encore en cours lors de cette vérification.

### Références de force liées aux exercices

Le socle relie les nouveaux tests à une fiche d’exercice, avec convention de charge conservée. Le coach choisit explicitement un maximum testé, estimé ou une valeur de travail ; un nouveau test ne remplace pas ce choix. Le calcul de pourcentage utilise le pas d’arrondi de la fiche. L’assistance et le poids du corps ne sont pas assimilés à une charge externe. Les anciennes clés sont conservées ; leur rapprochement exige une correspondance confirmée, un motif et une trace d’audit. Les variantes concurrentes sont refusées. Procédure et limites : `docs/references-force.md`.

Le web permet de définir la convention dans la bibliothèque, ajouter un test lié, le choisir comme référence ou fixer une valeur de travail. Le constructeur propose la référence de la fiche ; il refuse une référence liée à une autre variante, y compris dans une adaptation. Les API et le client partagé exposent les mêmes règles au mobile, qui affiche désormais le nom lié. Les formulaires natifs restent à développer.

Preuves locales du 7 novembre : **433 tests serveur, 77 tests domaine et 136 tests mobile réussis**, types de tout le monorepo verts. **Deux parcours navigateur sur build de production**, en 1440 px et 390 px, couvrent bibliothèque, fiche athlète, test sélectionné, ajout API d’un test plus élevé sans remplacement automatique et référence manuelle. Axe et absence de défilement horizontal passent. Lint : zéro erreur, quatre avertissements préexistants ; design : zéro travers. Un test vérifie aussi qu’une correction de série après changement de référence et suppression du test source conserve la prescription enregistrée. Après ajout du contrôle de précision au centième de kilogramme, les neuf tests ciblés de références passent.

Migration additive vérifiée sur base vierge par les suites et sur les **25 migrations historiques avec un test de force synthétique** : ancienne clé, valeur et absence de rattachement arbitraire conservées, application locale en 0,03 s. Preview Neon `br-floral-sun-b9iar8ge` migrée de 25 à 26 migrations en **5,57 s** ; tables de références et de rapprochement vides après application. Production inchangée.

CI de la PR 1 `5218ea1` : qualité **et compilation Android réussies**. La PR reste en brouillon pour la recette externe restante. CI qualité de la PR 2 `d07c92c` réussie ; cette preuve ne couvre pas encore le présent lot de références. Le gel des charges à la publication, la saisie détaillée web/native, le rapprochement via interface et les lots A, C, D et E restent à poursuivre.

### Gel dès publication des prescriptions individuelles

Le gel annoncé comme restant dans les lots précédents est désormais implémenté : une publication avec progression activée crée atomiquement les copies par athlète et version. Un changement de maximum, un déplacement de séance ou une consigne modifiée ne réécrit pas les charges inchangées. Une nouvelle prescription de charge utilise la référence actuelle. Une valeur manquante reste manquante ; aucun maximum n’est inventé. Les révisions antérieures, les adaptations et la source du calcul sont conservées.

Les arrivées par fiche coach et invitation figent les séances accessibles au moment de l’attribution, sans attendre une lecture. Les validations simples conservent leur version de prescription, tout en restant corrigeables par les anciennes apps. Les validations détaillées gardent leur copie historique ; la validation rapide coach incrémente aussi la version et enregistre son auteur. Les exports et suppressions incluent les nouvelles données. Voir `docs/prescriptions-figees.md` pour le comportement et les limites de migration.

Preuves locales du 7 novembre : **447 tests serveur et 81 tests domaine réussis** ; après raccordement de la validation rapide coach, **84 tests ciblés** de gel, progression et accès réussis. Les types de tous les packages, du web et du mobile passent. **Six parcours navigateur sur build de production** couvrent identité/conflits, API de publication et référence figée malgré un nouveau choix de maximum, en desktop et mobile ; les parcours de référence incluent Axe et absence de débordement. Lint : zéro erreur, quatre avertissements préexistants. Les tests du gel incluent aussi 120 athlètes, une panne SQL qui annule la publication entière, les invitations, l’export et l’effacement par athlète.

Migration additive éprouvée sur base vierge et sur **26 migrations historiques**, avec test de force et séance publiée synthétiques : aucune copie du passé inventée, application locale en 0,03 s. Preview Neon passée de 26 à **27 migrations en 2,39 s** ; aucune copie rétroactive créée, production inchangée. La CI qualité de `833144a` réussit ; le présent lot nécessite sa propre CI. Les interfaces de saisie détaillée web/native, l’actualisation explicite de charges depuis le constructeur et les autres lots restent à poursuivre.

Contrôle final du lot : la lecture borne la copie à la version de séance observée, même en cas de révision concurrente. Après ce contrôle et le cas de conservation automatique, **26 tests ciblés** et les **deux parcours navigateur de références** passent de nouveau. Le rôle applicatif Preview peut lire/écrire les nouvelles copies sans droit de création de tables. Les copies de publication automatique ne prolongent pas l’activité de l’espace.

### Conservation hors ligne des saisies en conflit

Les files web et natives conservent désormais les conflits HTTP 409 et les autres refus permanents de saisies versionnées. Les actions suivantes de la même séance attendent une résolution ; les autres séances peuvent se synchroniser. Aucun numéro de version n'est remplacé automatiquement. Les écritures bloquées et leurs dépendances ne sont plus présentées comme des validations envoyées. Un bandeau persistant les distingue des envois ordinaires.

Les saisies détaillées web sont enregistrées dans IndexedDB avant le réseau ; un double déclenchement du même identifiant ne relance pas l'appel. Le mobile ne remplace plus une écriture versionnée par une validation rapide. Un changement de compte interrompt les envois suivants, et une réponse tardive ne modifie pas la file du nouveau compte. Sur le mobile natif, la déconnexion détache la file du compte sans effacer ses saisies en attente.

Le stockage natif reste dans SecureStore. Chaque écriture prépare une nouvelle génération de morceaux, puis bascule la tête seulement après leur sauvegarde. Un échec intermédiaire laisse la version précédente lisible ; les écritures concurrentes sont sérialisées et l'ancien format est repris. Un manque de stockage empêche l'envoi, affiche une consigne et permet de réessayer.

Preuves locales du 7 novembre : **147 tests mobiles réussis**, dont persistance après relance, refus d'accès, changement de compte pendant un appel, panne de stockage et compatibilité des anciens morceaux. Types du monorepo verts ; lint web sans erreur (quatre avertissements préexistants) ; Impeccable sans travers. **Deux parcours navigateur sur build de production** vérifient le conflit, le rechargement, l'absence de rejeu automatique, Axe et l'absence de débordement à 390 et 1440 px. Les réponses 409 de ces parcours sont simulées ; les contrôles serveur de version sont couverts par les suites métier précédentes.

Ce lot prépare la saisie détaillée : l'éditeur web/natif et son parcours de relecture/résolution restent à développer. Il ne constitue pas une preuve de saisie complète sur téléphone physique. Aucun changement de schéma ni migration externe dans ce lot. CI qualité de `16ac154` réussie (run `42406608388`) ; le lot hors ligne nécessite sa propre CI.

Compléments de recette : **10 tests ciblés web de file hors ligne** passent, dont deux saisies dans la même milliseconde. Les **quatre parcours historiques hors ligne**, validation athlète et appel coach sous Chromium et WebKit, réussissent sur build de production. Après le dernier ajustement de reprise du stockage, les quatre tests de l’adaptateur natif passent de nouveau.

### Éditeurs des séries réalisées — web et applications natives

Une entrée « Mes séries réalisées » est disponible depuis le détail web et le mode séance natif lorsque la progression est activée. Les séries sont proposées depuis la prescription mais ne comptent qu'après confirmation. L'athlète peut renseigner répétitions, charge/assistance, distance, durée et contacts, ajouter une série, distinguer travail/échauffement et préciser le comptage par côté. La charge externe totale est expliquée ; une ancienne fiche non classée exige un choix explicite. Les décimales françaises sont acceptées sans troncature silencieuse.

Le mode d'écriture `writeScope: sets` conserve le ressenti, la durée, le commentaire, la douleur et la date de validation existants ; il refuse un payload qui chercherait à modifier simultanément ces retours. Les mêmes contrôles de consentement, d'accès et de version restent appliqués. Les cases simples ne peuvent plus remplacer des séries détaillées, même avec une version valide. La suppression de tous les détails demande une confirmation. Les conventions de charge et le pas d'arrondi sont copiés dans les nouveaux snapshots sans attribuer rétroactivement une convention aux anciennes séances.

Les brouillons sont isolés par compte, espace et séance, sans données de santé. Une réponse confirmée est reconnue par son identifiant de mutation. Les saisies en attente restent dans la file protégée ; un conflit conserve les valeurs et empêche une nouvelle écriture aveugle. Les pages de séries des sept prochains jours sont ajoutées au cache web lorsque la progression est activée. Les champs natifs répétés ont des identifiants de libellés distincts et les choix annoncent leur sélection.

Preuves locales du 7 novembre : **456 tests serveur**, **86 tests domaine** et **147 tests mobiles** réussis. Après le garde-fou supplémentaire sur les anciennes cases, **14 tests ciblés de séries** réussissent. Types du monorepo verts ; lint sans erreur (quatre avertissements existants), Impeccable sans travers. **Deux parcours navigateur sur build de production**, 390 et 1440 px, vérifient brouillon après rechargement, deux séries de 4 × 40 kg = 320 kg, absence de troisième série supposée, conservation des retours, correction hors ligne puis synchronisation, nombres invalides et suppression confirmée. Axe, zoom 200 % et absence de débordement passent. Les bundles Hermes iOS et Android sont générés par Expo ; ce ne sont pas des builds signés ni une recette sur appareils physiques.

À terminer dans ce parcours : relecture/comparaison et résolution des conflits conservés, saisie coach depuis son interface, articulation des validations rapides et des compléments de retour avec les versions détaillées, puis intégration de l'historique et de la célébration unique. L'éditeur reste derrière le drapeau désactivé par défaut ; les écrans natifs doivent encore être éprouvés sur téléphone. La nouvelle DA appartient au lot A et n'est pas déclarée terminée par ces formulaires. Aucun changement de schéma SQL ni activation en production dans ce lot. CI qualité du lot précédent `2fde79b` réussie ; le présent lot nécessite sa propre CI.


### Validation rapide et compléments compatibles avec les séries détaillées

La validation rapide web/native utilise maintenant les versions de la séance et de la saisie. Deux périmètres explicites complètent `sets` : `status` conserve les retours existants, et `feedback` ne modifie que les champs envoyés. Ils exigent les versions et refusent un remplacement des séries détaillées. Les cases simples du mode séance restent compatibles. Le ressenti, la douleur, la durée, le commentaire et la date initiale ne disparaissent plus lors d’une validation rapide après saisie de charges.

Le complément suit la version de sa propre validation, y compris lorsque les deux actions sont en attente hors ligne. Le serveur renvoie la version de la mutation d’origine lors d’un rejeu ancien, sans la substituer par celle d’une correction ultérieure. Une correction concurrente reste un conflit. Sur mobile, les seules mutations locales ordonnées et sans conflit peuvent être enchaînées ; les anciennes écritures sans version et les trous dans la chaîne imposent une relecture. Rouvrir un retour hors ligne reprend les champs déjà en attente sans réintroduire une mutation que le serveur a déjà dépassée.

Les écrans natifs attendent une confirmation serveur ou une sauvegarde locale durable avant de fermer la feuille, effacer les cases du mode séance ou afficher la célébration. Une erreur de stockage, un conflit ou un changement de compte conserve le parcours et affiche l’erreur. Des clics répétés sur une séance déjà bloquée ne créent plus de nouvelles tentatives. Côté web, une panne de nettoyage IndexedDB après accusé serveur ne transforme pas la validation reçue en échec ; sa copie se rejoue avec le même identifiant.

La douleur existante peut être relue et retirée explicitement dans le complément. Les lectures athlète et coach masquent douleur et RPE lorsque le consentement santé n’est plus effectif. Un champ omis n’efface pas un autre retour et une douleur inchangée n’est pas renvoyée par le formulaire.

Preuves locales du 7 novembre : **460 tests serveur** réussis avant ajout du dernier cas de retrait du consentement et du nettoyage IndexedDB ; après ces ajouts, **18 tests ciblés de séries et 11 tests de file web** réussis. **153 tests mobiles**, **86 tests domaine**, types monorepo et vérification native finale réussis. Lint sans erreur (quatre avertissements existants), Impeccable sans travers. **Quatre parcours navigateur de production** passent à 390 et 1440 px : séries, validation rapide et complément hors ligne, retrait explicite de douleur, maintien des charges et conflit conservé sans multiplication des tentatives. Les **dix parcours historiques terrain**, sous Chromium et WebKit, passent également. Les essais natifs de ce lot portent sur la logique et le typage ; aucune recette sur téléphone physique n’est revendiquée.

Restent dans le lot B : comparaison et résolution explicite des conflits, saisie coach, interface native des références et actualisation explicite des prescriptions. L’historique, les records et la célébration enrichie appartiennent au lot C ; les lots A, D et E restent ouverts. Aucune migration SQL ni activation en production dans ce lot. Les CI du nouveau commit doivent encore être observées avant fusion.


### Relecture et résolution des envois en conflit — web et natif

Le bandeau de synchronisation ouvre maintenant un écran de comparaison entre les valeurs du serveur et les modifications conservées sur l’appareil. Appliquer les modifications ou abandonner l’envoi demande une confirmation explicite. Le remplacement du lot est atomique dans IndexedDB et durable dans SecureStore ; une panne de stockage conserve les originaux. Une nouvelle correction serveur pendant la relecture provoque un nouveau conflit, sans écrasement ni changement automatique de version. Les autres séances restent intactes.

Les modifications de prescription, de variante ou d’identité d’exercice empêchent une réattribution automatique des séries. Le consentement santé courant contrôle les valeurs structurées affichées et renvoyées. Les brouillons de séries ne sont libérés qu’après un accusé serveur ou un abandon explicite correspondant exactement au contenu envoyé ; une modification locale ultérieure, même sur une série non cochée, reste conservée. Les corrections versionnées préservent la date initiale de validation.

Preuves locales du 7 novembre : **465 tests serveur, 91 tests domaine et 155 tests mobiles réussis** ; types monorepo, lint sans erreur et Impeccable sans travers. Les **quatre parcours navigateur de production** (séries et relecture, desktop/mobile) réussissent : concurrence réelle entre deux contextes, nouvelle correction pendant la comparaison, confirmation/annulation d’abandon, persistance après rechargement et retour dans l’éditeur. Axe et absence de débordement sont vérifiés. Exports Expo Hermes iOS et Android générés ; aucun build signé ni essai physique revendiqué.

Le parcours couvre les envois de validation de l’athlète dans l’espace courant. Il ne résout pas encore les brouillons jamais envoyés devenus obsolètes, ni tous les autres types de la file (appel, commentaire, tentative). La saisie coach et les formulaires natifs des références restent à développer. Aucune migration ni activation en production dans ce lot. La CI qualité de `da12c08` est réussie ; ces changements nécessitent leur propre CI avant fusion.


### Brouillons non envoyés devenus obsolètes

L’éditeur web/natif propose maintenant une relecture des séries actuelles et du brouillon local, y compris les valeurs non confirmées. Le choix « Reprendre mon brouillon » met à jour sa version attendue uniquement après confirmation et seulement si la prescription, la variante et les références d’exercice sont inchangées. Une autre prescription impose une reprise manuelle ; aucun exercice n’est réattribué. Le choix destructif « Repartir des séries enregistrées » exige une confirmation distincte. Aucun de ces choix n’écrit sur le serveur : l’athlète conserve l’étape d’enregistrement. Les envois déjà en file et les brouillons modifiés ailleurs empêchent une reprise aveugle.

L’éditeur natif prend également en compte le résultat explicite de mise en file avant toute confirmation de succès. Un refus ne peut plus être interprété comme un envoi réussi au seul motif qu’aucune nouvelle opération n’est en attente.

Preuves locales : **93 tests domaine**, types monorepo, lint ciblé et Impeccable réussis. **Deux parcours navigateur de production** (390/1440 px) couvrent reprise, annulation, remplacement confirmé, absence d’écriture serveur pendant le choix, enregistrement ultérieur et rechargement ; Axe et absence de débordement passent. Exports Hermes iOS et Android générés avec ces écrans. Les tests serveur ne sont pas relancés pour ce lot sans changement serveur ; les preuves natives restent automatisées, sans appareil physique.

### Préparation du déploiement de fiabilité

Nouvelle sauvegarde chiffrée GitHub `42413533493`, source `1852b25`, créée le 7 novembre à 20 h 57 UTC : réussie. Restauration isolée locale en **0,16 s**, puis migrations exactes de la branche PR 1 via Prisma en **0,95 s** : passage de 21 à 24 migrations, 12 comptes, 2 espaces et 60 séances conservés. Base et fichiers temporaires supprimés. Un premier essai de comptage employait un mauvais nom de table ; le nouvel essai utilise `scheduled_sessions` et vérifie les trois compteurs avant/après. Aucune modification de la production.

Le compte Stripe de production Tartan `acct_1UXJjd4TQfkM7TmX` expose un webhook actif vers `https://app.tartan.coach/api/webhooks/stripe`, version `2025-03-31.basil`, pour création/modification/suppression d’abonnement. Cette lecture confirme sa configuration, pas la réception signée d’un événement par l’application.


### PR 1 déployée en production

Fusion de #44 le 7 novembre à **21 h 01 UTC**, commit `98daa94`. Vercel Ready, domaines `tartan.coach`, `app.tartan.coach` et `www.tartan.coach` associés au bon commit. Lecture Neon production : **24 migrations appliquées, zéro migration inachevée**, activité métier initialisée pour les deux espaces. Aucun espace ne possède encore de client Stripe ; l’absence de payeur de facturation sur ces espaces gratuits est conforme à la reprise conditionnelle. Les routes publiques `/api/live`, `/api/health`, `/api/auth/get-session` et `/connexion` répondent HTTP 200 ; les deux sondes renvoient `status: ok`. Les vérifications n’ont créé ni paiement ni envoi de message.

La PR 2 est reciblée vers main, reste en brouillon et conserve ses fonctionnalités nouvelles hors production. Le passage en production des correctifs de fiabilité ne valide pas à lui seul l’ouverture commerciale ni les stores.


### Références de force — formulaires natifs

La fiche athlète ouvre les tests et références quand la progression est activée pour l’espace et que le membre est propriétaire ou coach. L’écran permet de rechercher une fiche compatible, consulter sa référence actuelle et les tests liés, ajouter un test (sans le choisir automatiquement), sélectionner explicitement un ancien test ou définir une valeur de travail. Le changement de référence annonce son effet sur les prescriptions futures et conserve les séances figées. Changer d’exercice avec des champs non enregistrés demande confirmation. Les contrôles serveur d’espace, de rôle et de groupe restent appliqués.

La bibliothèque native permet de renseigner la convention de charge et le pas d’arrondi ; une convention déjà utilisée reste protégée par le serveur. Les décimales françaises sont acceptées sans troncature. L’API `/me` expose le drapeau de progression uniquement dans les espaces actifs du membre, avec champ facultatif pour les anciennes réponses mises en cache. Une date de test impossible est désormais refusée par le contrat commun au lieu d’être normalisée au mois suivant.

Preuves locales : **467 tests serveur, 158 tests mobiles**, types de tout le monorepo puis contrats revalidés après correction de date, lint ciblé et Impeccable réussis. Exports Hermes iOS/Android générés avec le nouvel écran. Les deux nouveaux cas serveur vérifient la portée du drapeau et l’absence d’écriture pour une date impossible ; les tests mobiles vérifient décimales, bornes, rattachement et choix de référence explicite. Aucune recette physique ni validation VoiceOver/TalkBack de ce nouvel écran n’est revendiquée. Aucun changement de schéma ni activation en production. Restent dans le lot B : interface de saisie coach, rapprochement historique et actualisation explicite des charges.


### Séries réalisées saisies par le coach — web et natif

Code `4d2df2c`, vérifié localement le 7 novembre 2026. Le suivi de séance ouvre l’éditeur pour chaque athlète autorisé, avec brouillons et files distincts. La comparaison des conflits nomme l’athlète et ne bloque pas les autres saisies. Le serveur limite l’assistant aux séances dont il est l’auteur. Une correction conserve le retour de l’athlète et enregistre l’identité du coach.

**470 tests serveur, 94 domaine, 160 mobiles**, types monorepo, lint sans erreur et Impeccable réussis. Deux nouveaux parcours coach sur build de production, puis huit parcours de non-régression séries/relecture/hors ligne réussis, incluant Chromium et WebKit. Le premier parcours desktop a révélé un chevauchement du bandeau hors ligne avec Réglages : corrigé par un décalage suivant la hauteur réelle du bandeau, puis retesté. Exports Hermes iOS/Android réussis. Aucune migration ni activation en production ; appareils physiques et CI du nouveau commit restent à vérifier.

[Preuves, commandes et captures du lot](preuves-v1-1/lot-b-series-coach.md). La CI qualité de `9ad481b` est réussie (`42414716957`) ; sa compilation Android était encore en cours au dernier contrôle. Ce lot termine l’interface de saisie coach, pas l’ensemble du lot B : rapprochement historique et actualisation explicite des charges restent ouverts. Les lots A, C, D et E ne sont pas déclarés terminés.


### Rapprochement historique — interfaces web et natives

Code `7519866`, vérifié le 7 novembre 2026. Les réglages du propriétaire exposent les tests non rattachés et les correspondances confirmées. Choix de fiche sans présélection, convention/consignes visibles, motif et vérification obligatoires, puis confirmation récapitulative. Une clé inconnue reste conservée sans action ; les références de travail ne sont jamais choisies automatiquement. Le rapport API est typé et fournit le nom et la convention de la fiche.

**11 tests serveur ciblés**, types monorepo puis natifs, lint sans erreur, Impeccable et exports Hermes iOS/Android réussis. **Deux parcours navigateur sur build de production**, avec annulation sans écriture, refus d’accès athlète, clé inconnue longue, rechargement, Axe et rendu 390/768/1440 px ; zoom 200 % sans débordement. [Preuves et captures](preuves-v1-1/lot-b-rapprochement-force.md). Ni migration ni opération sur les données de production. La CI et la recette native physique restent distinctes.

Dans le lot B, la commande explicite d’actualisation des charges déjà prescrites reste à réaliser. Le rapprochement via interface et la saisie coach ne sont plus des écrans manquants. Les lots A, C, D et E ainsi que les recettes externes restent ouverts.


### Actualisation explicite des charges publiées — web et natif

Le coach relit les charges et leurs sources avant confirmation. Les pourcentages sont recalculés sur les références actuelles, sans conversion des kilogrammes absolus ni du RPE/RIR. Les athlètes ayant une saisie conservent leur prescription ; une convention incompatible est signalée. Un changement de version, référence, audience ou saisie après aperçu impose une nouvelle relecture. Les nouvelles copies, l’audit et les notifications sont transactionnels ; aucune notification ne contient de charge ou de santé.

Preuves du code `25557b0` : 477 tests serveur sur la suite complète, puis 32 tests ciblés après les derniers ajustements ; 98 tests domaine et 160 mobiles ; types monorepo, lint et design réussis. Deux parcours de production desktop/mobile, Axe, 390/768/1440 px et zoom 200 % réussis. Exports Hermes iOS/Android réussis, sans recette physique revendiquée. Cas de 120 athlètes, concurrence, panne de copie et panne de mise en file couverts. Détails et capture : `docs/preuves-v1-1/lot-b-actualisation-charges.md`.

Aucune migration ni activation en production. La CI qualité de `5e5a3bf` est réussie (run `42417182212`) ; Android reste en cours au moment de cette preuve. Les nouveaux commits nécessitent leur propre CI. Le prochain chantier est le lot A : repositionnement préparation physique, interface et constructeur natif, puis les historiques/records, phases/analyses et IA.


### Surfaces de travail claires — web et natif

Première partie du lot A : palette de travail craie/blanc/encre, actions rouge piste, navigation compacte et titres réduits. Les catégories de séance disposent de teintes et libellés de même importance. L’accueil et les écrans immersifs conservent leurs palettes expressives. Les dialogues web et feuilles natives suivent le contexte ; champs, focus et statuts ont été adaptés aux surfaces claires. `DESIGN.md` consigne la direction explicitement choisie dans le plan V1.1.

Preuves locales du 7 novembre : types monorepo réussis, 168 tests mobiles et 61 tests de tokens, lint sans erreur (quatre avertissements existants), Impeccable sans travers. Deux parcours navigateur de production couvrent 30/60/120 athlètes, calendrier, bibliothèque/dialogue, constructeur et liste vidéo, à 390/768/1440 px, avec Axe et zoom 200 %. Quatre parcours de non-régression références/actualisation des charges passent également. Le premier essai du nouveau parcours ne créait aucune séance publiée et affichait donc l’état vide du suivi ; fixture corrigée, puis deux parcours réussis. Exports Hermes iOS et Android réussis. Aucune recette sur appareil physique ni validation VoiceOver/TalkBack revendiquée.

Ce lot ne termine pas le repositionnement : constructeur natif, onboarding, bibliothèque relue, vidéo générique et landing restent à livrer. Aucun changement de schéma ni activation de progression en production.


### Constructeur natif — création, édition et publication

Le calendrier natif ouvre un constructeur en conservant groupe et semaine ; les brouillons et séances publiées sont modifiables. Les blocs club/autonomie/communs, la recherche d’exercices, les déplacements, prescriptions détaillées, adaptations individuelles, modèles et publication différée utilisent les mêmes contrats/services que le web. Publication relue séparément ; modification d’une séance publiée explicitement annoncée. Les versions périmées imposent une relecture, les clics concurrents sont bloqués et une création à réponse indéterminée n’est pas renvoyée automatiquement. La clé du brouillon reçu est conservée si l’étape de publication échoue.

Les dates/heures des contrats partagés refusent désormais les jours et heures impossibles. Le résumé partagé affiche les charges absolues et les cibles RPE/RIR distinctes, y compris zéro RIR. Les valeurs décimales françaises sont conservées.

Preuves locales du 7 novembre : 502 tests serveur, 178 mobiles, 99 domaine ; types monorepo puis natifs après les derniers changements ; lint web sans erreur (quatre avertissements existants), Impeccable sans travers. Deux parcours HTTP authentifiés sur build de production couvrent le transport utilisé par le natif, identités après déplacement, adaptations, versions obsolètes, publication, modèles et refus athlète. Exports Hermes iOS/Android réussis avec ces écrans. Le simulateur iOS et le client de développement ont démarré, mais la recette interactive n’a pas pu commencer : Mac verrouillé pour l’outil d’interface. Les serveurs 3102/8083 et le simulateur lancés pour cet essai ont été arrêtés ; aucun serveur préexistant n’a été arrêté.

La saisie non enregistrée du constructeur reste en mémoire : persistance chiffrée, reprise après fermeture et résolution de ses brouillons obsolètes restent à réaliser. La suppression native des séances/modèles et la recette VoiceOver/TalkBack restent également ouvertes. Les saisies de séries déjà livrées disposent de leur propre stockage hors ligne ; ne pas confondre les deux parcours. Cette étape ne termine donc ni la parité du constructeur ni le lot A.


### Vidéo générique — préparation physique

La capture native ne crée plus systématiquement un essai de saut. Les outils hauteur deviennent explicites, les remarques génériques restent sans phase et les anciens essais/annotations conservent leur contexte. Les listes, imports et indications web/natives emploient un vocabulaire général ; les adresses historiques sont conservées. [Preuves du lot](preuves-v1-1/lot-a-video-generique.md).

101 tests domaine, 199 mobiles, un scénario serveur d’import sans essai, deux parcours navigateur de production (Axe, 390/768/1440 px et zoom 200 %) et le parcours de ralenti existant réussis. Capture générique et activation/repli des outils vérifiés sur simulateur iOS. Aucun import ou envoi Mux réel revendiqué. Deux crashs distincts du client de développement restent à isoler ; les exports ne prouvent pas la stabilité sur téléphone. Le titre du constructeur suit maintenant son état enregistré après création.


### Profil sportif — onboarding et réglages

Disciplines sans hauteur présélectionnée, objectifs de préparation, matériel et objectif du premier groupe disponibles sur web et natif. Réglages modifiables par le propriétaire ; champs omis par les anciens clients conservés. Migration additive éprouvée sur schéma ancien synthétique puis Preview Neon (28 migrations), sans changement en production. 516 tests serveur, 199 mobiles, deux parcours navigateur, types, lint, design et exports réussis. Lecture, modification et persistance vérifiées dans le simulateur iOS. [Preuves et limites](preuves-v1-1/lot-a-profil-sportif.md).


### Bibliothèque de préparation physique

49 fiches distinctes, tags et conventions de charge copiés pour les nouveaux espaces, sans réécriture des fiches existantes. Doublons retirés de la bibliothèque initiale ; endurance et mobilité renforcées. 103 tests domaine, 17 tests serveur ciblés et types monorepo réussis. Les médias de démonstration et la recette coach restent ouverts. [Preuves](preuves-v1-1/lot-a-bibliotheque.md).


### Historique par exercice — services et calculs

Lecture bornée par période, séries figées, références actuelles séparées, corrections immédiatement visibles et contrôle d’accès. Règles pures de comparaison/records sans célébration automatique. 108 tests domaine, six tests serveur ciblés, types et lint réussis. [Preuves et limites](preuves-v1-1/lot-c-historique-socle.md). Interfaces et intégration des records restent ouvertes.


### Calculateur web et natif

Epley, saisie française, estimation distincte de la référence du tableau, choix explicite et 13 pourcentages exacts/arrondis. Aucune référence enregistrée modifiée. 110 tests domaine, 523 serveur, types, lint, design, exports Hermes et parcours navigateur réussis ; calcul/tableau/bornes vérifiés sur simulateur iOS. [Preuves](preuves-v1-1/lot-c-calculateur.md). Le commit vidéo `079418d` dispose désormais de ses deux CI réussies : qualité `42426108440`, Android `42426108438`. Les commits ultérieurs ont besoin de leur propre CI.


### Historique par exercice — interfaces et volumes

Sélection d’exercice et de période, références actuelles distinctes des prescriptions figées, séries détaillées, courbes par unité et tableau accessible sur web/natif. Références manuelles seules incluses ; archive, manque et troncature explicites. [Preuves et portée de la couverture](preuves-v1-1/lot-c-historique-interface.md). Les records/célébrations et analyses complètes ne sont pas déclarés terminés.


### Rappel des réalisations comparables

Rappel web/natif dans les séries athlète/coach, séparé de la prescription et recalculé après correction/suppression. Recherche par convention sur l’historique, horaires explicites pour le même jour, douze séries maximum avec total affiché et accès au détail contextualisé. [Preuves et limites](preuves-v1-1/lot-c-rappel-series.md). Le test de confirmation d’âge responsable de l’échec CI de `7764dfd` est corrigé dans `4782ebc` et repasse localement ; une nouvelle CI distante reste nécessaire.

### Courbes de force par provenance

Tests 1RM/3RM, estimations du coach, charges réalisées à répétitions égales et Epley sont présentés séparément sur le web et le natif. Référence inchangée, conventions distinctes, couverture et tableau équivalent. [Preuves du lot](preuves-v1-1/lot-c-courbes-force.md). Les records confirmés et la célébration ne sont pas livrés par cet ajout.

### Records de séries confirmés

Records toutes périodes, lecture paginée sans troncature, premières références distinctes, corrections et suppressions prises en compte. Réponse de mutation versionnée, encart statique web/natif après accusé direct et aucun rejeu lors de la synchronisation différée. [Preuves](preuves-v1-1/lot-c-records-confirmes.md). La célébration de validation et les records de performances athlé typées restent à implémenter.

### Célébration unique et performances athlé — suite du lot C

La célébration de séance est désormais enrichie des records confirmés, avec revendication serveur unique et respect de la réduction des animations. Les performances athlé disposent de règles comparables, de corrections versionnées et d'une création dédupliquée sur web/natif. Voir [célébration](preuves-v1-1/lot-c-celebration.md) et [performances](preuves-v1-1/lot-c-performances-athle.md). Les recettes physiques restent ouvertes.

### Phases de préparation — gestion et partage

Création privée, partage explicite, groupe ou athlète, périodes libres sans chevauchement, frise calendrier, accès Progrès et gestion native. Versions, concurrence, reprise de création, export et conservation testés ; aucune modification automatique des séances. 549 tests serveur, 131 domaine, 201 mobiles et deux parcours navigateur de production réussis. Preview à 31 migrations, production inchangée. [Preuves et limites](preuves-v1-1/lot-d-phases.md).

Les règles de priorité individuelle et de choix multi-groupes sont testées, mais leur intégration au contexte des constructeurs reste ouverte, ainsi que les analyses complètes du lot D et l'IA du lot E. Les écrans natifs de ce lot restent à éprouver sur simulateur et téléphones. PR #45 reste en brouillon.

### Analyse prévue/réalisée commune au web et au natif

Le tableau d'analyse est disponible derrière le flag progression, depuis Suivi et Progrès. Il distingue volumes prescrits conservés, séries réalisées, absence de saisie et couverture. Les courbes utilisent la même échelle et coupent les données manquantes ; un tableau équivalent reste accessible. Périmètre groupe/athlète, quatre ou douze semaines, un an et période de phase. Le contexte de phase choisi n'étant pas encore historisé avec la séance, le filtre de phase est explicitement un filtre de dates et de cible. Aucun rattachement historique n'est prétendu.

Répartition par exercices et catégories, diversité sur 28 jours et comparaison à la période précédente de même durée ajoutées. L'effort × durée n'est lu que pour les athlètes ayant consenti, avec journal de lecture sans contenu santé et nombre de réponses complet. Les statuts « manqué » automatiques ne comptent pas comme réponses. Les nouveaux écrans natifs ne persistent pas les analyses sensibles. Preuves et limites : `docs/preuves-v1-1/lot-d-analyse.md`.

### Publication groupée web et native

Sélection explicite de 1 à 14 brouillons, publication immédiate après relecture, contrôle des droits, versions et phases au dernier moment. Un conflit annule tout le lot ; le rejeu immédiat après réponse perdue ne recrée ni prescriptions ni notifications. Les notifications sont regroupées par destinataire et inscrites dans la même transaction. Le rafraîchissement après conflit empêche la réouverture prématurée d’une sélection périmée.

Preuves du 8 novembre : 586 tests serveur réussis, dont six scénarios de publication groupée ; test domaine partagé réussi ; deux parcours navigateur sur build de production en 22,3 s, Axe, 390/768/1440 px et zoom 200 %. Types monorepo et exports Hermes iOS/Android réussis. Aucun test de réception réelle ni nouvelle recette visuelle native revendiqués. Voir [preuve détaillée](preuves-v1-1/lot-a-publication-groupee.md).

### Premier socle du planificateur IA

Contrat strict de sortie, séparation questions/proposition, limites de période/séances, contrôle des jetons autorisés et conversion vers les prescriptions existantes. Adaptateur OpenAI sans outil d’écriture, `store:false`, erreurs neutralisées et arrêt global désactivé par défaut. L’alias local `OPEN_AI_API_KEY` est supporté ; aucune valeur de clé n’est inscrite au dépôt. 14 tests domaine et 9 tests d’adaptateur simulé réussis, types monorepo verts.

Ce socle ne constitue pas une fonction disponible : aucun endpoint, quota persistant, transcription ou écran de planificateur n’est encore branché. [Preuves et limites](preuves-v1-1/lot-e-socle-ia.md).

### Réservations de quota IA

Migration additive 34 : compteurs mensuels par espace, opérations dédupliquées et bail de cinq minutes, fuseau de l’espace par défaut Europe/Paris. Le résultat et sa consommation se confirment dans la même transaction ; le fournisseur est appelé en dehors. Les pannes et résultats tardifs ne doublent pas les consommations. Les réservations expirées sont restituées lors d’une nouvelle demande ou par le cron, même IA désactivée.

Preuves : **608 tests serveur** réussis, dont 13 de quotas ; 35 tests ciblés quotas/adaptateur/cron/isolation réussis, types monorepo et lint ciblé verts. Migration 33 → 34 en **0,024 s** sur schéma ancien synthétique, en **3,34 s** sur Preview Neon ; zéro compte, permissions applicatives vérifiées, aucune activation et aucune modification de production. [Preuve détaillée](preuves-v1-1/lot-e-quotas-ia.md). Le workflow des propositions et les interfaces restent à brancher ; aucune consommation réelle OpenAI n’a été effectuée pour cette recette.
