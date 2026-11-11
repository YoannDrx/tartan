# État du projet

Mis à jour le 11 novembre 2026. Toute PR qui change un état met ce fichier à jour.

**En une phrase :** le code de la V1 et de la V1.1 est en production et testé automatiquement, mais rien n'est encore vendu, car ni le paiement réel, ni les téléphones, ni l'avis juridique ne sont faits.

**Portes d'ouverture franchies : 0 sur 10** ([commercialisation](plans/commercialisation.md)). Huit dépendent du fondateur en tout ou partie.

**Ordre décidé le 11 novembre 2026 :** vendre la web app, puis refondre la direction artistique, puis livrer le jeu. Les stores suivent.

## Ce qui tourne

| Élément | État |
| --- | --- |
| Site | `tartan.coach` : film, piste continue, tarifs intégrés, vraies captures |
| Application | `app.tartan.coach` : coach, athlète, API, console d'administration |
| Inscriptions | Fermées : création d'espace coach sur invitation |
| Espaces en production | 2 espaces pilotes, comptes presque tous fictifs |
| Administrateur | Le fondateur, passkey enrôlée |
| CI | Verte. Le dépôt est public pour disposer des minutes GitHub Actions |
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
| Abonnements Stripe | Oui | Simulé, et sandbox sans paiement | **Aucun vrai paiement** |
| Remboursements, factures, litiges | Oui | Simulé | Non |
| E-mails | 25 e-mails | Rendu, déclencheurs de facturation | Seul le lien magique a été reçu |
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
| F14 | Régler le compte Stripe pour le réel ; relancer `stripe-setup` en production après le lot A4 | [Stripe](plans/stripe.md) | Vrai paiement |
| F15 | Choisir où stocker les sauvegardes, hors de GitHub | [sauvegarde](exploitation/sauvegarde.md) | Lot A13 |
| F16 | Ouvrir une session Stripe CLI sur la sandbox pour le lot A7 | [Stripe](plans/stripe.md) | T03 |
| F17 | Valider les six athlètes sur la planche `/admin/mascotte`, après le lot B3 | [direction artistique](plans/direction-artistique.md) | Refonte des écrans |

### Agents : vendre la web app

Un lot, une branche, une PR. Détail des lots : [web](plans/web.md).

| Lot | Contenu | État |
| --- | --- | --- |
| A1 | Personas, matrice d'accès T04 | À faire |
| A2 | T01 webhook Stripe, T02 RevenueCat | À faire |
| A3 | Garde-fous : couleurs et textes en dur refusés par le lint | Codé, testé. 274 textes d'avant la règle restent gelés dans 48 fichiers |
| A4 | Finitions du paiement : action bancaire requise, bandeau d'impayé, plafond atteint, factures | Codé, testé. Webhook de production à compléter par F14 |
| A5 | T05 actions d'administration, T06 export comptable | À faire |
| A6 | T07 suppression de compte, T08 connexion Apple et Google | À faire |
| A7 | T03 paiement de bout en bout en sandbox | À faire, après F16 |
| A8 | Registre des e-mails, exemption des e-mails de sécurité, invitations par la file | Codé, testé |
| A9 | Onboarding du coach en trois temps, guide « Pour démarrer » en quatre étapes sur une règle partagée | Codé, testé |
| A10 | E-mails de cycle de vie et préférences | À faire |
| A11 | Accueil de l'athlète, bienvenue, relance d'invitation | À faire |
| A12 | Centre d'aide et contact | À faire |
| A13 | Sauvegardes hors de GitHub, sondes de disponibilité et des notifications | À faire, après F2, F3, F15 |

### Agents : direction artistique, ajouts et jeu

Détail : [direction artistique](plans/direction-artistique.md) et [web](plans/web.md).

| Lot | Contenu | État |
| --- | --- | --- |
| B1 | Jetons de mouvement, filet de mouvement réduit, miroir complet des couleurs | À faire |
| B2 | Squelette unique de la mascotte, paquet `packages/mascot` | À faire |
| B3 | Six épreuves, six athlètes, composants de piste | À faire |
| B4 | Transitions de page | À faire |
| B5 | Page d'accueil et site | À faire |
| B6 à B9 | Application : ossature, athlète, coach, finitions | À faire |
| C1 à C3 | Absence signalée, série de régularité, carte de record | À faire |
| J1 à J10 | Jeu « Tartan Meeting » : simulation, page, classement, aperçu, épreuves, combiné | À faire |

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
- **Connexion aux prestataires jamais éprouvée** : le bug vidéo vient d'un code jamais exercé avec un vrai webhook. Considère tout ce qui n'est pas « éprouvé » ci-dessus comme suspect.
- **Sentry gratuit** : une seule sonde de crons active. La sonde de disponibilité et celle des notifications attendent une place.
- **Skew Protection** Vercel refusée par l'API : à activer à la main si l'offre l'inclut.
- **iPhone, PWA** : les notifications exigent l'ajout à l'écran d'accueil, d'où l'intérêt de l'app native.
- **Écart entre `schema.prisma` et les migrations** : la base issue des migrations porte une valeur par défaut sur l'identifiant de `athlete_consents`, `email_outbox` et `external_deletions`, et une règle de suppression différente sur `checkout_intents`. Sans effet connu à l'exécution, mais `pnpm db:migrate` s'arrête pour demander un nom de migration. À aligner dans le schéma avant la prochaine migration.
- **Textes en dur hérités** : 274 textes gelés dans 48 fichiers (`apps/web/eslint-suppressions.json`), dont les pages légales et les objets d'e-mail. La règle ne voit pas les messages d'erreur ni les métadonnées de page. Les hexadécimaux de `globals.css` ne sont contrôlés qu'en partie, jusqu'au lot B1.
- **Webhook Stripe de production incomplet** tant que F14 n'est pas faite : l'événement `invoice.payment_action_required` n'y est pas encore abonné, et la console l'affiche.
- **Jeu public** : le rejeu serveur prouve qu'un score découle d'appuis valides, pas qu'un humain a joué. Le classement demande une modération.

## Hors périmètre de la V1

La liste est dans [PRODUCT.md](../PRODUCT.md#hors-périmètre). Tout ajout passe par une décision du fondateur, consignée là-bas.
