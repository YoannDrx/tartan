# Plan : mettre la web app en état de vendre

Objectif : une web app et une PWA qu'un coach inconnu peut trouver, payer et utiliser sans aide. Le mobile natif suit sans retarder cette ouverture. L'avancement est dans [../ETAT.md](../ETAT.md).

## Finalisation du 13 novembre 2026

Ce périmètre autorisé remplace l'ancien ordre « vente, puis améliorations ». Les lots A/B/C déjà livrés restent l'historique des capacités à préserver. Une branche et une PR par lot F ; l'état des preuves vit uniquement dans ETAT.md.

| Lot | Dépendances | Livrable et critère de fin                                                                                                                                                                                       |
| --- | --- | --- |
| F0  | —           | Documentation réconciliée, runtime Node 22 et pnpm 10 reproductible. Toute preuve distingue code, test et usage réel.                                                                                            |
| F1  | F0          | Main protégé, Preview isolée accessible au mobile, récupération Neon sept jours après souscription, sauvegarde privée sans repli public, restauration chronométrée, alertes reçues, Resend signé, Mux configuré. |
| F2  | F0          | Structure versionnée exercice/récupération/groupe répété, deux niveaux maximum ; règles partagées, identifiants stables, anciennes séances et prescriptions préservées.                                          |
| F3  | F0          | Catalogue de 150 fiches distinctes, guides/visuels contrôlés et versionnés, mise à disposition des espaces existants sans écraser leurs variantes.                                                               |
| F4  | F2          | Constructeur progressif de circuits/supersets, duplication/déplacement/regroupement/annulation, aperçu athlète, sauvegarde explicite, clavier et trois thèmes.                                                   |
| F5  | F2, F3      | Modes « Mettre en forme » et « Proposer », résolution/création privée d'exercice sans perte de contexte, dictée et qualification indépendante.                                                                   |
| F6  | F0          | Upload athlète privé par défaut, feedback horodaté, partage volontaire révocable, quotas et isolation serveur, reprise d'envoi.                                                                                  |
| F7  | F1 à F6     | Matrice écrans/routes/rôles et recette complète ; sandbox navigateur puis paiement réel accompagné ; aucun défaut critique ou majeur connu.                                                                      |
| F8  | F7          | Site/aide/captures cohérents, support prêt, ouverture décidée par le fondateur avec réserves visibles, surveillance 72 h.                                                                                        |
| F9  | F2 à F6     | Contrats et parcours natifs à niveau, binaires du commit validé, installation physique par TestFlight et Play organisation sur invitation. Ne retarde pas F8.                                                    |

### Contrats, historique et constructeur (F2, F4)

Ajouter la structure de séance sans retirer les champs encore lus par des clients. Exercices, récupérations explicites et groupes répétés conservent leurs identifiants ; l'exécution produit des occurrences distinctes dans l'ordre exact A/B/A/B. Deux niveaux de répétitions maximum, taille d'exécution bornée côté serveur. Séparer récupération entre séries, entre exercices et entre tours ; aucune récupération finale implicite.

Les copies à la publication, charges résolues, adaptations individuelles et réalisations passées restent figées. L'ancien client lit une projection fidèle mais ne peut pas réenregistrer une séance complexe aplatie : refus explicite et mise à jour demandée. Même règle pour modèles, IA, suivi et mode séance. Toute conversion est idempotente.

Le constructeur commence par titre/date/destinataires/contenu. Ajouts : exercice, récupération, groupe à répéter. Séries compactes, circuit contenant les exercices, tours et repos ; variantes club/autonomie sans duplication obligatoire. Aperçu du déroulé, duplication, déplacement, regroupement/dissociation, annulation et état du brouillon. Couleurs sémantiques par jetons, jamais seules porteuses du sens ; commandes clavier en plus du glisser-déposer. Vérifier 390/768/1440 px, trois thèmes et mouvement réduit.

### Catalogue et guides (F3)

Répartition : 40 musculation, 15 haltérophilie/éducatifs, 20 mobilité, 20 pliométrie/sauts/explosivité, 15 course/accélération, 10 gainage, 10 coordination/plots, 10 escaliers, 10 échauffement. Reprendre les 55 fiches existantes sans doublons artificiels. Garder les catégories historiques et ajouter les facettes nécessaires.

Chaque fiche : nom et synonymes FR/EN, objectif/matériel/niveau, installation, étapes, respiration pertinente, repères, erreurs, régression/progression, convention de charge et comptage par côté, positions illustrées et alternative textuelle, source/licence/attribution et statut de validation par un coach. Inclure arraché, épaulé, jeté et épaulé-jeté avec variantes réellement distinctes.

Illustrations originales ou licence de chaque média vérifiée (wger possible). Ne pas reprendre en masse les images aux droits contestés de free-exercise-db. Pas d'API externe nécessaire pour lire une fiche. Identifiant et version de catalogue ; import aux espaces existants sans écraser les personnalisations ni les références historiques. Les créations de coach restent privées. Guide accessible à l'athlète depuis sa séance autorisée ; cache des guides/visuels de ses séances téléchargées, disponibilité vidéo annoncée séparément.

### Planificateur (F5)

Reformater fidèlement une consigne ou proposer une séance à partir d'objectif/durée/niveau/matériel/destinataires/date : deux modes explicites. Afficher source, hypothèses et suggestions ; demander une clarification plutôt qu'inventer date, maximum ou donnée de santé. Proposition spontanée fondée sur le catalogue contrôlé. Uniquement des brouillons après validation du coach.

Exercice inconnu : noms/synonymes/variantes, correspondances proposées, choix ou reformulation ou création privée vérifiée. Reprendre la proposition sans perdre les réponses ; créations et confirmations idempotentes. Le contrat distingue résolu/à clarifier/à créer. Recherche pertinente au-delà de 500 fiches, sans tronquer arbitrairement le catalogue. Destinataire hors périmètre : clarification utile, pas erreur générique. Une proposition logique consomme un quota, reprises techniques bornées. Consentement et purge vérifiés, aucun audio conservé ni contenu sensible journalisé.

Conserver les modèles configurés jusqu'à comparaison mesurée. Garder les 60 cas historiques en régression, figer 80 nouveaux cas avant réglage, rejouer trois fois : au moins 95 % conformes et zéro date/charge inventée ou substitution silencieuse acceptée. Trente enregistrements humains, avec bruit, iOS et Android, vérification des nombres/unités/exercices/repos ; revue par des coachs. Le faux prestataire et les scripts audio ne qualifient pas la fonction en réel.

### Vidéo collaborative (F6)

Athlète identifié par la session serveur ; dépôt pour lui-même et une séance autorisée. Visible à l'auteur et au staff habilité, restrictions de groupes conservées. Partage au groupe explicite et révocable. Démonstration d'exercice distincte d'une vidéo personnelle, aucune promotion implicite. Commentaires horodatés/réponses, vue coach à examiner, pagination et filtres athlète/séance/exercice/traitement.

État d'envoi/encodage/reprise compréhensible ; même quota d'espace pour coach et athlète. Réservations concurrentes, doublons, fichiers refusés, erreurs d'encodage, assets orphelins et webhooks hors ordre couverts. Lecture signée avec durée résiduelle documentée à la révocation. Retrait de membre/consentement, suppression et signalements couverts ; notifications neutres. Le forfait Mux à la demande ne supprime pas les quotas commerciaux.

### Recette et ouverture (F7, F8)

Matrice de tous les écrans/routes : rôle, données accessibles, parcours nominal, erreur, état vide et preuve. Parcours : coach neuf/invitation/athlète ; constructeur/publication/adaptation ; charges historiques ; deux modes IA et exercice inconnu ; vidéo collaborative ; hors ligne/fermeture/conflit ; absence/progression/phases/records ; notifications/heures calmes ; abonnement/portail/facture/impayé/résiliation/remboursement ; droits/export/suppression/transfert ; administration/aide/signalements/versions.

Node 22/pnpm 10 : types, lint, tests, design, E2E_PROD ; tests de compatibilité et de concurrence. Prestataires réels séparément : sandbox Stripe dans le navigateur avec carte et 3DS, paiement réel accompagné sur compte pilote autorisé, livraison Gmail/Outlook/iCloud, Mux, push et alertes, restauration isolée, dictées humaines. Pas de nouveau compte de test créé en production. Toute fonction vendue doit être disponible et prouvée ; aucun P0/P1 ouvert. Validation simple toujours sous dix secondes. Recette terrain et téléphones distincte des émulateurs.

Mise à jour des textes/captures/aide selon les fonctions disponibles, support et incident opérationnels. Avis juridique existant déclaré validé, DPA effectivement acceptés à confirmer ; médiateur différé et clé actuelle conservée par décision du fondateur, réserves non closes. Ouverture uniquement par le fondateur puis surveillance 72 h des erreurs, invitations, paiements, notifications, uploads et coûts. Le pilote mesure ensuite l'adoption.

### Natif (F9)

Porter contrats/constructeur/guides/IA/vidéo, puis traiter les écarts absence/régularité/record. Builds du commit validé ; caméra/micro/photothèque/HEVC/HLS, interruptions/réseau faible/arrière-plan, liens et push, mise à jour avec données en attente sur téléphones physiques. Aucun prix/lien d'achat dans les parcours natifs. TestFlight externe après revue ; Play organisation avec D-U-N-S, signature, déclarations santé/données/dataSync, installation depuis le canal invité. Un binaire construit ou une soumission en brouillon ne prouve pas la distribution. Détails dans les plans iOS/Android.

## Étape 0 : finir le code de vente

Un lot, une branche, une PR. L'état de chaque lot est dans [../ETAT.md](../ETAT.md).

| Lot | Branche | Contenu | Fini quand |
| --- | --- | --- | --- |
| A1 | `test/personas-authz` | Personas, matrice d'accès T04, liste blanche des routes publiques | Toute route de `app/api/**/route.ts` a sa ligne |
| A2 | `test/webhooks-paiement` | T01 route du webhook Stripe avec vraie signature, T02 RevenueCat | Six cas Stripe, quatre RevenueCat |
| A3 | `feat/garde-fous-da` | Règles ESLint locales : pas de couleur brute, pas de palette par défaut, pas de texte en dur. Les textes existants sont gelés dans `eslint-suppressions.json`, qui ne peut que rétrécir | Toute nouvelle infraction échoue |
| A4 | `feat/paiement-finitions` | Événement `invoice.payment_action_required` et son e-mail ; bandeau d'impayé dans tout l'espace coach, pour le propriétaire ; plafond atteint : dialogue vers `/abonnement`, jamais dans l'app native ; page Factures ; réconciliation à curseur tournant ; CGV qui lisent `packages/domain/src/plans.ts` | Test de route, e2e `/abonnement` |
| A5 | `test/admin-actions` | T05, T06 | Six actions, export |
| A6 | `test/compte-social` | T07, T08 | Tests verts |
| A7 | `test/stripe-sandbox` | T03, avec une session Stripe CLI du fondateur | Cycle complet en sandbox |
| A8 | `feat/email-registry` | Registre unique des e-mails, catégorie obligatoire à l'envoi, e-mails de sécurité exemptés des plaintes et désinscriptions, invitations par la file, objets dans `packages/i18n` | Rendu de chaque genre, aucun nouvel e-mail |
| A9 | `feat/premiers-pas-coach` | Onboarding en trois temps, liste « Premiers pas » sur `/suivi` | E2E d'un coach neuf à 390 px |
| A10 | `feat/emails-cycle-de-vie` | Séquence d'activation, plafond presque atteint, préférence « conseils ». La reconquête attend l'avis du juriste | Tests à horloge figée |
| A11 | `feat/accueil-athlete` | Accueil après invitation, e-mail de bienvenue, relance d'invitation | E2E et axe à 390 px |
| A12 | `feat/aide` | Page `/aide`, aide courte par écran, contact dans l'application | E2E et axe |
| A13 | `feat/exploitation-vente` | W8 et W9 ci-dessous | Copie restaurée, panne simulée reçue |

Parallèles sans fichier commun : A1 avec A2, A5 avec A6, A8 avec A9. Le détail des e-mails est dans [emails.md](../reference/emails.md), celui des parcours dans [onboarding.md](../reference/onboarding.md).

Après A4, le fondateur relance `stripe-setup` en production pour ajouter l'événement au webhook : la console affiche le webhook incomplet d'ici là. Le rattrapage horaire des abonnements traite jusqu'à 200 espaces en 40 secondes au plus, les plus anciennement vérifiés d'abord.

## Étape 1 : finir la configuration

| N° | Action | Qui | Vérification |
| --- | --- | --- | --- |
| W1 | Passkey de secours sur un second appareil, depuis `/admin/configuration` | Fondateur | Compteur à 2 dans Configuration, connexion avec chacune |
| W2 | Créer dans Resend le webhook `https://app.tartan.coach/api/webhooks/resend` sur `email.bounced`, `email.complained`, `email.suppressed` | Fondateur | Livraison de test acceptée dans Resend |
| W3 | Poser `RESEND_WEBHOOK_SECRET` en production, puis redéployer | Fondateur | Ligne « Webhook Resend » à En place dans Configuration |
| W4 | Vérifier le domaine `mail.tartan.coach` dans Resend (SPF, DKIM, DMARC), puis régler `EMAIL_FROM` | Fondateur, agent pour les DNS si accès | E-mail reçu avec le bon expéditeur, non classé en indésirables |
| W5  | Conserver la clé selon décision du fondateur ; confirmer l'accord de traitement OpenAI                                                  | Fondateur                              | Planificateur toujours fonctionnel                             |
| W6 | Ajouter une carte Mux, puis lever le plafond vidéo dans Configuration | Fondateur | Le message « espace vidéo plein » ne peut plus survenir |
| W7 | Passer Neon en offre payante, protéger la branche de production | Fondateur | Restauration à 7 jours disponible |
| W8 | Sortir les sauvegardes de GitHub ([procédure](../exploitation/sauvegarde.md)) | Agent, après choix du stockage | Copie chiffrée restaurée depuis la nouvelle destination |
| W9 | Offre Sentry suffisante, activer la sonde de disponibilité et celle des notifications | Fondateur, agent | Panne simulée reçue par e-mail |
| W10 | Activer Skew Protection dans Vercel si l'offre l'inclut | Fondateur | Ancien onglet fonctionnel pendant un déploiement |

## Étape 2 : prouver les parcours

1. Écrire et faire passer les tests critiques T01 à T08 de [automatisation.md](../tests/automatisation.md).
2. Dérouler [recette-reelle.md](../tests/recette-reelle.md), sections 1 à 5 et 7.
3. Corriger chaque écart, puis rejouer l'étape concernée. Un écart est testé sur environnement isolé ; la preuve du prestataire réel et le contrôle de déploiement sont consignés séparément.

## Étape 3 : conformité

1. Obtenir l'avis écrit du juriste ([questions](../reference/conformite.md)).
2. Adhérer à un médiateur, renseigner son nom dans `apps/web/app/(public)/cgv/page.tsx`.
3. Appliquer les corrections demandées aux pages légales.
4. Retirer la mention « version de travail » de `apps/web/src/features/shell/legal-page.tsx`.
5. Signer les accords de traitement manquants avec chaque sous-traitant.

## Étape 4 : retirer les données fictives et répéter

1. `pnpm --filter @tartan/web demo:fill <e-mail> --retirer` pour le compte du fondateur.
2. Répétition complète en local ou Preview avec un compte neuf : landing, création d'espace, invitation, séance, validation, paiement, résiliation, suppression du compte.
3. Vérifier que `/admin/configuration` n'indique plus aucun « À faire ».

## Étape 5 : ouvrir

Décision du fondateur uniquement, portes franchies ([commercialisation](commercialisation.md)).

1. `/admin/configuration` → Inscriptions : Ouvertes à tous.
2. Dans la minute, la landing affiche « Créer mon espace coach ».
3. Un compte neuf crée son espace et atteint la page de paiement.

## Étape 6 : surveiller 72 heures

Chaque jour : Sentry, livraisons des webhooks Stripe, Resend (rebonds, plaintes), capacité Mux, consommation Neon, écran Opérations de la console, livraison des notifications.

## Après l'ouverture : ajouts décidés le 11 novembre 2026

| Lot | Branche | Contenu |
| --- | --- | --- |
| C1 | `feat/absence-athlete` | L'athlète signale qu'il ne viendra pas, motif en liste fermée sans donnée de santé ; visible dans le suivi et le centre de notifications du coach |
| C2 | `feat/regularite` | Série de régularité : règle pure dans `packages/domain`, affichée en tour de piste sur l'accueil de l'athlète et sur sa fiche côté coach |
| C3 | `feat/carte-record` | Image générée côté serveur avec l'athlète de l'épreuve, partagée par le menu du téléphone, sans donnée de santé |

La refonte visuelle et le jeu sont dans [direction-artistique.md](direction-artistique.md).

## Retour arrière

Les gestes sont dans [exploitation](../exploitation/README.md#retour-arrière) : inscriptions et vente depuis Configuration, déploiement précédent sur Vercel, coupure du planificateur IA, restauration.

Pendant un incident de vente, ne redéploie pas aveuglément une ancienne logique de Checkout : elle ignorerait les intentions en attente. Préfère un correctif en avant. La conduite d'un incident est dans [incident.md](../exploitation/incident.md).
