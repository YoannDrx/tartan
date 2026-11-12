# État du projet

Mis à jour le 12 novembre 2026. Toute PR qui change un état met ce fichier à jour.

**En une phrase :** le code de la V1 et de la V1.1 est en production et testé automatiquement, mais rien n'est encore vendu, car ni le paiement réel, ni les téléphones, ni l'avis juridique ne sont faits.

**Portes d'ouverture franchies : 1 sur 10** ([commercialisation](plans/commercialisation.md)). La porte 10 est franchie le 11 novembre 2026 : les tests critiques T01 à T08 sont verts. Deux réserves : T03 tourne contre la sandbox Stripe, hors de la CI, à la demande ; le flux Maestro de T07 est écrit, jamais exécuté. Huit des neuf portes restantes dépendent du fondateur en tout ou partie.

**Ordre décidé le 11 novembre 2026 :** vendre la web app, puis refondre la direction artistique, puis livrer le jeu. Les stores suivent.

## Ce qui tourne

| Élément | État |
| --- | --- |
| Site | `tartan.coach` : film en relais de trois athlètes, piste continue, bande du groupe, tarifs intégrés, questions fréquentes, vraies captures |
| Application | `app.tartan.coach` : coach, athlète, API, console d'administration |
| Inscriptions | Fermées : création d'espace coach sur invitation |
| Espaces en production | 2 espaces pilotes, comptes presque tous fictifs |
| Administrateur | Le fondateur, passkey enrôlée |
| CI | Verte. Plafonnée à 45 minutes depuis la panne des dépôts Ubuntu du 11 novembre 2026. Le dépôt est public pour disposer des minutes GitHub Actions |
| iOS | Archive 1.1.0 (12) envoyée à App Store Connect, non soumise à la revue |
| Android | Rien de publié, build EAS en échec, compte Play à créer |

## Niveau de preuve par domaine

« Testé » : tests automatisés, prestataires simulés sauf mention. « Éprouvé » : constaté en production ou sur appareil réel.

| Domaine | Codé | Testé | Éprouvé en réel |
| --- | --- | --- | --- |
| Connexion, âge, onboarding | Oui | Oui | Lien magique reçu sur Gmail. Le parcours d'un compte neuf reste à jouer |
| Connexion Apple et Google | Oui, coupée | Non | Non |
| Espaces, invitations d'athlètes | Oui | Oui | À jouer avec un vrai e-mail |
| Invitation de coachs, changement d'espace | Oui | Service seulement | Non |
| Séances, constructeur, calendrier, suivi | Oui | Oui | Oui, sur le web |
| Charges, références de force, progression, phases | Oui | Oui | Partiel, sur le web |
| Vidéo, annotations | Oui | Service et webhook signé | Un envoi web réel, réparé le 9 novembre. Envoi mobile non joué |
| Planificateur IA | Oui, clé en place | Oui, prestataire simulé | Un essai réel sur le web. Corpus réel 59/60 |
| Notifications, centre, préférences | Oui | Oui | Push réels jamais joués |
| Versions et mises à jour | Oui | Oui | Non |
| Abonnements Stripe | Oui | Simulé, et cycle complet en sandbox : carte de test, facture payée, webhooks signés reçus en HTTP, e-mails, remboursement, résiliation | **Aucun vrai paiement**. La saisie de carte sur la page Checkout n'est pas automatisée |
| Remboursements, factures, litiges | Oui | Simulé | Non |
| E-mails | 29 e-mails | Rendu, déclencheurs de facturation et d'activation | Seul le lien magique a été reçu |
| Export, suppression de compte | Oui | Oui | Sur le web |
| Console d'administration | Oui | Partiel | Accès passkey éprouvé |
| Hors ligne, PWA | Oui | Oui | Pas au stade |
| Mobile natif | Oui | Modules purs seulement, aucun rendu d'écran | Simulateur, jamais sur téléphone physique |

Le détail par écran et par route est dans [tests/README.md](tests/README.md).

## Ce qui reste à faire

Les numéros renvoient aux étapes des plans. Trié par impact sur l'ouverture.

### Fondateur

| N° | Action | Plan | Bloque |
| --- | --- | --- | --- |
| F1 | Lancer « E-mails de test → Tous » dans `/admin/configuration`, sur Gmail, Outlook, iCloud. À refaire après le lot A10 | [recette](tests/recette-reelle.md) | Preuve des e-mails |
| F2 | Créer le webhook Resend et poser `RESEND_WEBHOOK_SECRET` | [web](plans/web.md) | Rebonds et plaintes |
| F3 | Décider de l'expéditeur : `tartan@yodev.fr` aujourd'hui, `tartan.coach` recommandé | [web](plans/web.md) | Image, délivrabilité |
| F4 | Avis écrit du juriste, HDS d'abord. Dossier prêt, treize questions | [conformité](reference/conformite.md) | Vente, soumission stores, classement du jeu, e-mail de reconquête |
| F5 | Adhérer à un médiateur, CM2C recommandé | [commercialisation](plans/commercialisation.md) | CGV, vente |
| F6 | Remplacer la clé OpenAI anciennement exposée, signer l'accord de traitement | [web](plans/web.md) | Vrais athlètes |
| F7 | Carte Mux, puis lever le plafond de 10 vidéos dans Configuration | [web](plans/web.md) | Revue stores, vente |
| F8 | Neon payant, pour la restauration à 7 jours | [web](plans/web.md) | Vente |
| F9 | Dérouler la recette réelle | [recette](tests/recette-reelle.md) | Vente |
| F10 | Téléphone public professionnel, statut de commerçant sur les deux stores | [iOS](plans/ios.md) | Stores |
| F11 | Demande de D-U-N-S, puis compte Google Play. Passer en compte personnel sans numéro le 20 novembre | [Android](plans/android.md) | Android |
| F12 | Passkey de secours sur un second appareil | [web](plans/web.md) | Risque de blocage de la console |
| F13 | Prévenir les deux espaces pilotes des fonctions activées | [commercialisation](plans/commercialisation.md) | Confiance |
| F14 | Régler le compte Stripe pour le réel. Le webhook de production écoute les 15 événements depuis le 11 novembre (constaté par l'API Stripe) | [Stripe](plans/stripe.md) | Vrai paiement |
| F15 | Choisir où stocker les sauvegardes, hors de GitHub | [sauvegarde](exploitation/sauvegarde.md) | Lot A13 |
| F16 | Fait le 11 novembre : la session Stripe CLI est ouverte sur la sandbox | [Stripe](plans/stripe.md) | — |
| F17 | Valider les six athlètes sur la planche `/admin/mascotte`. Ils sont déjà sur le site depuis le lot B5, par décision du 12 novembre | [direction artistique](plans/direction-artistique.md) | Refonte des écrans |

### Agents : vendre la web app

Un lot, une branche, une PR. Détail des lots : [web](plans/web.md).

| Lot | Contenu | État |
| --- | --- | --- |
| A1 | Personas, matrice d'accès T04 | Codé, testé. Toute nouvelle route doit recevoir sa ligne dans `tests/api-authz.matrix.ts` |
| A2 | T01 webhook Stripe, T02 RevenueCat | Codé, testé. La route Stripe répond 503 sans secret et 500 en cas de panne |
| A3 | Garde-fous : couleurs et textes en dur refusés par le lint | Codé, testé. 267 textes d'avant la règle restent gelés dans 46 fichiers |
| A4 | Finitions du paiement : action bancaire requise, bandeau d'impayé, plafond atteint, factures | Codé, testé. Webhook de production à compléter par F14 |
| A5 | T05 actions d'administration, T06 export comptable | Codé, testé. L'export répondait 500 à un refus : corrigé en 401 et 403 |
| A6 | T07 suppression de compte, T08 connexion Apple et Google | Codé, testé. Le flux Maestro de suppression est écrit, jamais exécuté. La connexion Apple et Google reste éteinte en production |
| A7 | T03 paiement de bout en bout en sandbox | Codé, passé en sandbox le 11 novembre. Hors CI : à relancer à la main avant l'ouverture |
| A8 | Registre des e-mails, exemption des e-mails de sécurité, invitations par la file | Codé, testé |
| A9 | Onboarding du coach en trois temps, guide « Pour démarrer » en quatre étapes sur une règle partagée | Codé, testé |
| A10 | E-mails d'activation (J+1, J+3, J+7), plafond presque atteint, préférence « conseils » | Codé, testé. Reconquête non construite, en attente de F4 |
| A11 | Accueil de l'athlète sur sa page, e-mail de bienvenue, rappel d'invitation avec opposition par adresse | Codé, testé |
| A12 | Centre d'aide `/aide` en huit thèmes, « Aide » par écran dans le menu Réglages, contact | Codé, testé |
| A13 | Sauvegardes hors de GitHub, sondes de disponibilité et des notifications | À faire, après F2, F3, F15 |

### Agents : direction artistique, ajouts et jeu

Détail : [direction artistique](plans/direction-artistique.md) et [web](plans/web.md).

| Lot | Contenu | État |
| --- | --- | --- |
| B1 | Jetons de mouvement, filet de mouvement réduit, miroir complet des couleurs, CSS mort retiré | Codé, testé |
| B2 | Squelette unique de la mascotte, paquet `packages/mascot` | Codé, testé. Film vu en production ; mobile non regardé sur appareil |
| B3 | Six épreuves, six athlètes, composants de piste, planche `/admin/mascotte` | Codé, testé. Planche regardée rendue en local à 390, 768 et 1440 px. Aucun écran ne s'en sert encore : la revue du fondateur (F17) décide de la suite |
| B4 | Transitions de page | Codé, testé : fondu du contenu, bandeau piste et en-tête du site qui restent en place, onglet actif qui glisse. La carte de séance qui s'ouvre en écran de séance est venue avec le lot B7 |
| B5 | Page d'accueil et site | Codé, testé : film ramené à 3 hauteurs d'écran sur téléphone et 4,5 sur ordinateur, en relais de trois athlètes ; captures en une colonne ; bande du groupe ; tarifs en cartes sur téléphone ; six questions du centre d'aide ; athlètes sur la page introuvable et la page hors ligne. L'aperçu du jeu attend le lot J4 |
| B6 | Ossature de l'application | Codé, testé : en-tête du téléphone sans le nom d'espace tronqué, libellés de la barre basse et pastille de notifications à 12 px, athlète de la rubrique dans les seize états vides et sur la page d'erreur, feuilles, menus et messages qui entrent et sortent. Les deux rubriques en icône seule de l'en-tête du coach restent : les déplacer change la navigation, donc revient au fondateur |
| B7 | Écrans de l'athlète | Codé, testé : l'accueil et l'écran de séance ouvrent sur le bandeau piste, dans les trois thèmes ; l'écran de séance tient en un bandeau et une feuille ; la carte du jour s'ouvre en feuille de séance ; en thème clair, la carte du jour se détache du fond. Mode séance, progrès, calendrier et vidéos de l'athlète : regardés à 390 px, sans défaut relevé hors de ceux des lots B8 et B9 |
| B8 | Écrans du coach | Codé, testé : « Publier » collé au-dessus de la barre de navigation dans le constructeur sur téléphone ; actions du bandeau sur une ligne qui défile ; plus aucun texte sous 12 px, règle gardée par un test. Les douze écrans du coach regardés à 390 px, sans débordement. Pas de refonte écran par écran : suivi, calendrier, exercices, athlètes, vidéos, planificateur, analyse, phases, abonnement et réglages gardent leur mise en page |
| B9 | Application : finitions | Codé, testé : console d'administration en cartes sur téléphone (une carte par ligne, plus aucun défilement de côté), tableau conservé dès la tablette ; connexion et création de l'espace avec le groupe sur une ligne de piste, la pose d'Inès suivant les trois temps ; athlète dans le bandeau de cinq e-mails. Couleurs et durées des écrans immersifs : déjà toutes en jetons, rien à reprendre. Non vérifié : aucun e-mail reçu dans une vraie messagerie avec l'illustration (les images ne sont servies qu'après le déploiement), aucun vrai téléphone |
| C1 | Absence signalée | Codé, testé : « je ne viens pas » prévient les coachs une fois (notification sans motif, catégorie des alertes coach), pour une séance à venir ; motif facultatif en liste fermée sans santé, lu dans le suivi de la séance ; « je viens » l'efface ; migration additive (`attendance.absence_reason`). Non vérifié : notification reçue sur un vrai téléphone ; l'application mobile ne propose pas encore le motif |
| C2 | Série de régularité | Codé, testé : règle pure `packages/domain/src/regularity.ts` (une semaine compte quand chaque séance due est rendue, en entier ou en partie ; une absence signalée excuse ; une semaine sans séance ne casse rien ; une séance manquée arrête la série) ; tour de piste sur l'accueil de l'athlète (la semaine en cours, le nombre de semaines au centre), valeur sur la fiche côté coach. Non vérifié : aucun vrai téléphone ; l'application mobile ne l'affiche pas encore |
| C3 | Carte de record | Codé, testé : image PNG 1080 × 1350 générée à la demande (`next/og`), avec le prénom, la discipline, la marque, la date et l'athlète de l'épreuve ; ni lieu, ni vent, ni santé ; seul un record battu a sa carte ; l'athlète et ses coachs y ont accès ; partage par le menu du téléphone, enregistrement à défaut, depuis la page Progrès. Non vérifié : partage sur un vrai téléphone (iOS, Android), rendu des polices sur Vercel |
| J1 | Jeu « Tartan Meeting » : noyau de simulation et 110 m haies, paquet `packages/game` | Codé, testé. Mêmes scores sous Node, Chromium et WebKit. Ni rendu ni serveur |
| J2 | Jeu : la page `/jeu` | Codé, testé : le 110 m haies se joue au clavier (Espace, Entrée, Échap) et au pouce (bouton de 64 px) ; rendu canvas qui suit la simulation de J1 ; rien du jeu n'est chargé avant le premier geste ; record sur l'appareil, rien n'est envoyé ; page au plan du site et ouverte aux robots ; image de partage tirée une fois (`pnpm --filter @tartan/web og:jeu`). Vu en production le 12 novembre : une course lancée sur tartan.coach/jeu dans Chromium en format téléphone, chrono qui court, aucune erreur ni blocage de la politique de sécurité. Non vérifié : partie jouée sur un vrai téléphone, fluidité sur un téléphone d'entrée de gamme |
| J5 | Jeu : saut en longueur | Codé, testé : épreuve `longJump` de `packages/game` (élan aux appuis brefs, appel tenu dont l'angle monte, mordu au-delà de la planche, essai nul avant le sable), parties de référence et 300 journaux aléatoires identiques sous Node, Chromium et WebKit ; jouable sur `/jeu`, qui propose désormais le choix de l'épreuve. Vu en production le 12 novembre : un saut joué sur tartan.coach/jeu, sans erreur. Non vérifié : partie sur un vrai téléphone |
| J6 | Jeu : triple saut | Codé, testé : épreuve `tripleJump` (élan et appel de la longueur, cloche-pied rasant, puis un appui à chaque réception : juste, l'élan est gardé ; hors de la fenêtre de ±12 pas, rythme cassé), références et 300 journaux identiques sous Node, Chromium et WebKit ; jouable sur `/jeu`, avec un repère citron au point de contact. Vu en production le 12 novembre : un essai joué sur tartan.coach/jeu, sans erreur. Non vérifié : partie sur un vrai téléphone |
| J7 | Jeu : saut en hauteur | Codé, testé : épreuve `highJump`, en concours (barre de 1,60 m, +5 cm après chaque hauteur franchie, trois échecs de suite arrêtent tout) ; appui pour l'appel, tenu pour le cambré, relâché pour les jambes ; références et 300 journaux identiques sous Node, Chromium et WebKit ; jouable sur `/jeu`, avec un repère citron au point d'appel. Non vérifié : partie sur un vrai téléphone |
| J8 | Jeu : saut à la perche | Codé, testé : épreuve `poleVault`, sur la règle des concours à barre mise en commun avec la hauteur (`bar-event.ts`, références de la hauteur inchangées) ; barre de 4,20 m, +15 cm ; appui au planté, tenu pendant la flexion, relâché au renversement ; un concours tient toujours dans les 90 s d'une partie ; références et 300 journaux identiques sous Node, Chromium et WebKit ; jouable sur `/jeu`. Non vérifié : partie sur un vrai téléphone |
| J9 | Jeu : lancer du disque | Codé, testé : épreuve `discus` (tenir pour la volte qui accélère jusqu'à 720° par seconde, relâcher dans le secteur de ±17°, mordu hors du secteur, sorti du cercle au-delà de trois tours), références et 300 journaux identiques sous Node, Chromium et WebKit ; jouable sur `/jeu`, avec un cadran vu de dessus (secteur et bras). Non vérifié : un lancer valable regardé à l'image ; partie sur un vrai téléphone |
| J10 | Jeu : combiné | Codé, testé : les six épreuves à la suite, un essai chacune ; barème entier et linéaire dans `packages/game/src/combined.ts` (0 à 1 000 points par épreuve, 1 200 au plus, une marque nulle vaut 0) ; total et record sur l'appareil. Le classement du combiné viendra avec J3. Non vérifié : un combiné complet joué à la main |
| J4 | Jeu : aperçu sur la page d'accueil | Codé, testé : « Échauffe-toi sur les haies », après la ligne d'arrivée ; affiche statique, la simulation et le dessin ne se chargent qu'au clic (vérifié sur le contenu des scripts), puis la course se joue sur la page ; lien vers les six épreuves. Effet sur les inscriptions : à lire dans les pages vues (`/jeu`, `/connexion?creer=1`), aucun événement d'audience ajouté. Non vérifié : en production |
| J3 | Classement du jeu | Codé, testé, **éteint** : tables `game_runs`, `game_scores`, `game_bans` (migration additive) ; service public `game.service.ts` (jeton d'essai à usage unique, rejeu serveur du journal des appuis, contrôle de durée réelle, plafond par épreuve, pseudo filtré, limitation de débit, bannissement, effacement sans compte, empreinte IP purgée à 30 jours) ; routes `/api/v1/game/*` ; console `/admin/jeu` ; réglage « Classement du jeu » dans `/admin/configuration`, fermé par défaut. Le 12 novembre, le fondateur rapporte l'accord du juriste ; la mention « Le jeu du site » est ajoutée à la politique de confidentialité. Reste à basculer le réglage, qui revient au fondateur |

### Agents : mobile, IA et suite des tests

| N° | Tâche | Plan | Priorité |
| --- | --- | --- | --- |
| M1 | Échec EAS à « Read app config » : cause trouvée et corrigée (TypeScript importé par la configuration). Reste un build de production réel à lancer | [Android](plans/android.md) | Bloque Android |
| M2 | Maestro sur simulateur en CI, flux non conditionnels : T09 | [automatisation](tests/automatisation.md) | Avant soumission |
| M3 | Captures Android 1080 × 1920, capture de l'analyse vidéo iOS | [captures](exploitation/captures.md) | Avant soumission |
| M4 | Changement de compte par lien magique sur mobile : cause probable corrigée (ordre cookie, cache, espace actif), codé et testé. Reste le flux Maestro dédié et l'essai sur simulateur | [iOS](plans/ios.md) | Avant soumission |
| M5 | Repli HLS du lecteur mobile si le MP4 n'est pas prêt : codé et testé (`src/lib/playback-source.ts`). Reste à voir une vidéo lue juste après l'encodage, sur téléphone | [iOS](plans/ios.md) | Avant soumission |
| M6 | Connexion Apple native : le code d'autorisation est échangé et le jeton gardé pour la révocation (codé, testé). Reste `APPLE_APP_BUNDLE_IDENTIFIER` sur Vercel et un essai réel le jour où Apple est activé | [iOS](plans/ios.md) | Seulement si activée |
| T-suite | Tests élevés, moyens et faibles : T09 à T26. Fait : T10 (vidéo en HTTP, file d'envoi), T11, T22, T25 (routes techniques), T15, T16, T17 (gardes d'accès), T21 (worker), T12, T13 (invitation nominative, changement d'espace), T14 (page abonnement), T18 (centre de notifications), T19 (pages remplies), T20 (fiches de la console). Hors CI, documentés : T23 (IA réelle, payante), T24 (Maestro). Restent : T09 avec M2, T26 si le parcours parental s'ouvre | [automatisation](tests/automatisation.md) | Après l'ouverture web |
| P1 | Modèle de transcription : `gpt-transcribe` par défaut depuis le 12 novembre 2026 (codé, testé). Reste une vraie dictée, après F6, et le contrôle de `AI_TRANSCRIPTION_MODEL` sur Vercel | [IA](reference/planificateur-ia.md) | Échéance |
| P2 | Enregistrer les 30 dictées réelles du corpus IA | [IA](reference/planificateur-ia.md) | Qualité IA |

## Décisions ouvertes

| Sujet | Options | Recommandation |
| --- | --- | --- |
| Licence du dépôt public | Aucune (tous droits réservés), propriétaire explicite, open source | Fichier `LICENSE` propriétaire, tant que le dépôt reste public |
| Reprise automatique d'un appel IA si un jour manque | Garder (coût OpenAI en plus) ou retirer | Garder pendant la bêta, mesurer le coût |
| Abonnement web face à Apple | Soumettre sans achat intégré, ou ajouter l'achat intégré | Soumettre sans, repli préparé. Risque de refus réel (3.1.1) |
| IA à la première revue Apple | Ouverte ou fermée | Ouverte, avec compte de revue en offre Coach (règle 2.5.19) |
| Durée de la bêta IA | À fixer | Après 30 jours de vrais usages |
| Suppression après 24 mois d'inactivité | À valider par le juriste | Voir [conformité](reference/conformite.md) |
| Compte Stripe | Compte propre à Tartan, ou compte actuel qui sert plusieurs produits | Compte propre, avant le premier vrai paiement |
| Classement du jeu ouvert à tous | Avis du juriste rapporté favorable le 12 novembre 2026 ; classement en production, éteint | Le fondateur l'ouvre dans `/admin/configuration` quand il le souhaite |

## Risques à garder en tête

- **HDS** : la question la plus lourde. Une réponse défavorable peut imposer de changer d'hébergeur.
- **Refus Apple 3.1.1** : l'exception 3.1.3(f) ne vise pas un outil de coaching.
- **Webhook Stripe** : T01 couvre `customer.subscription.*` en CI ; les événements de facture et de remboursement ne passent par la route que dans la recette sandbox (T03), hors CI. Les litiges ne passent par aucun test de la route. La route RevenueCat ne répond pas explicitement en cas de panne.
- **Connexion aux prestataires jamais éprouvée** : le bug vidéo vient d'un code jamais exercé avec un vrai webhook. Considère tout ce qui n'est pas « éprouvé » ci-dessus comme suspect.
- **Sentry gratuit** : une seule sonde de crons active. La sonde de disponibilité et celle des notifications attendent une place.
- **Skew Protection** Vercel refusée par l'API : à activer à la main si l'offre l'inclut.
- **iPhone, PWA** : les notifications exigent l'ajout à l'écran d'accueil, d'où l'intérêt de l'app native.
- **Textes en dur hérités** : 267 textes gelés dans 46 fichiers (`apps/web/eslint-suppressions.json`), dont les pages légales et les objets d'e-mail. La règle ne voit pas les messages d'erreur ni les métadonnées de page. Depuis le lot B1, chaque couleur de `globals.css` est rapprochée d'un jeton par un test.
- **Jeu public** : le rejeu serveur prouve qu'un score découle d'appuis valides, pas qu'un humain a joué. Le classement demande une modération.

## Hors périmètre de la V1

La liste est dans [PRODUCT.md](../PRODUCT.md#hors-périmètre). Tout ajout passe par une décision du fondateur, consignée là-bas.
