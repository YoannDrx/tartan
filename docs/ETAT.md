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
| B9 | Application : finitions | À faire |
| C1 à C3 | Absence signalée, série de régularité, carte de record | À faire |
| J1 | Jeu « Tartan Meeting » : noyau de simulation et 110 m haies, paquet `packages/game` | Codé, testé. Mêmes scores sous Node, Chromium et WebKit. Ni rendu ni serveur |
| J2 à J10 | Page, classement, aperçu, cinq autres épreuves, combiné | À faire |

### Agents : mobile, IA et suite des tests

| N° | Tâche | Plan | Priorité |
| --- | --- | --- | --- |
| M1 | Comprendre l'échec des builds EAS à l'étape « Read app config » | [Android](plans/android.md) | Bloque Android |
| M2 | Maestro sur simulateur en CI, flux non conditionnels : T09 | [automatisation](tests/automatisation.md) | Avant soumission |
| M3 | Captures Android 1080 × 1920, capture de l'analyse vidéo iOS | [captures](exploitation/captures.md) | Avant soumission |
| M4 | Corriger le changement de compte par lien magique sur mobile, sans déconnexion | [iOS](plans/ios.md) | Avant soumission |
| M5 | Repli HLS sur le lecteur mobile si le MP4 n'est pas prêt (le web l'a) | [iOS](plans/ios.md) | Avant soumission |
| M6 | Connexion Apple : envoyer `authorizationCode` et stocker le jeton, pour la révocation | [iOS](plans/ios.md) | Seulement si activée |
| T-suite | Tests élevés, moyens et faibles : T09 à T26 | [automatisation](tests/automatisation.md) | Après l'ouverture web |
| P1 | Remplacer le modèle de transcription avant son arrêt annoncé le 26 février 2027 | [IA](reference/planificateur-ia.md) | Échéance |
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
| Classement du jeu ouvert à tous | Ouvrir avec le jeu, ou attendre l'avis du juriste sur les mineurs | Livrer le jeu avec records sur l'appareil, ouvrir le classement après l'avis |

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
