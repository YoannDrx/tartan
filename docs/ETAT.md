# État du projet

Mis à jour le 9 novembre 2026. Toute PR qui change un état met ce fichier à jour.

**En une phrase :** le code de la V1 et de la V1.1 est en production et testé automatiquement, mais rien n'est encore vendu, car ni le paiement réel, ni les téléphones, ni l'avis juridique ne sont faits.

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
| E-mails | 24 gabarits | Rendu | Seul le lien magique a été reçu |
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
| F1 | Lancer « E-mails de test → Tous » dans `/admin/configuration`, sur Gmail, Outlook, iCloud | [recette](tests/recette-reelle.md) | Preuve des e-mails |
| F2 | Créer le webhook Resend et poser `RESEND_WEBHOOK_SECRET` | [web](plans/web.md) | Rebonds et plaintes |
| F3 | Décider de l'expéditeur : `tartan@yodev.fr` aujourd'hui, `tartan.coach` recommandé | [web](plans/web.md) | Image, délivrabilité |
| F4 | Avis écrit du juriste, HDS d'abord. Dossier prêt | [commercialisation](plans/commercialisation.md) | Vente, soumission stores |
| F5 | Adhérer à un médiateur, CM2C recommandé | [commercialisation](plans/commercialisation.md) | CGV, vente |
| F6 | Remplacer la clé OpenAI anciennement exposée, signer l'accord de traitement | [web](plans/web.md) | Vrais athlètes |
| F7 | Carte Mux, puis lever le plafond de 10 vidéos dans Configuration | [web](plans/web.md) | Revue stores, vente |
| F8 | Neon payant, pour la restauration à 7 jours | [web](plans/web.md) | Vente |
| F9 | Dérouler la recette réelle | [recette](tests/recette-reelle.md) | Vente |
| F10 | Téléphone public professionnel, statut de commerçant sur les deux stores | [iOS](plans/ios.md) | Stores |
| F11 | Demande de D-U-N-S, puis compte Google Play. Passer en compte personnel sans numéro le 20 novembre | [Android](plans/android.md) | Android |
| F12 | Passkey de secours sur un second appareil | [web](plans/web.md) | Risque de blocage de la console |
| F13 | Prévenir les deux espaces pilotes des fonctions activées | [commercialisation](plans/commercialisation.md) | Confiance |

### Agents

| N° | Tâche | Plan | Priorité |
| --- | --- | --- | --- |
| A1 | Tests critiques des frontières : T01 à T08 | [automatisation](tests/automatisation.md) | Avant la vente |
| A2 | Sortir les sauvegardes de GitHub, le dépôt étant public | [exploitation](exploitation/sauvegarde.md) | Avant de vrais athlètes |
| A3 | Comprendre l'échec des builds EAS à l'étape « Read app config » | [Android](plans/android.md) | Bloque Android |
| A4 | Rendre l'expédition et la sonde de disponibilité opérationnelles (après F2, F3) | [web](plans/web.md) | Avant la vente |
| A5 | Maestro sur simulateur en CI, flux non conditionnels : T09 | [automatisation](tests/automatisation.md) | Avant soumission |
| A6 | Captures Android 1080 × 1920, capture de l'analyse vidéo iOS | [captures](exploitation/captures.md) | Avant soumission |
| A7 | Corriger le changement de compte par lien magique sur mobile, sans déconnexion | [iOS](plans/ios.md) | Avant soumission |
| A8 | Repli HLS sur le lecteur mobile si le MP4 n'est pas prêt (le web l'a) | [iOS](plans/ios.md) | Avant soumission |
| A9 | Connexion Apple : envoyer `authorizationCode` et stocker le jeton, pour la révocation | [iOS](plans/ios.md) | Seulement si activée |
| A10 | Tests élevés et moyens : T09 à T24 | [automatisation](tests/automatisation.md) | Après l'ouverture web |
| A11 | Remplacer le modèle de transcription avant son arrêt annoncé le 26 février 2027 | [IA](reference/planificateur-ia.md) | Échéance |
| A12 | Enregistrer les 30 dictées réelles du corpus IA | [IA](reference/planificateur-ia.md) | Qualité IA |

## Décisions ouvertes

| Sujet | Options | Recommandation |
| --- | --- | --- |
| Licence du dépôt public | Aucune (tous droits réservés), propriétaire explicite, open source | Fichier `LICENSE` propriétaire, tant que le dépôt reste public |
| Reprise automatique d'un appel IA si un jour manque | Garder (coût OpenAI en plus) ou retirer | Garder pendant la bêta, mesurer le coût |
| Abonnement web face à Apple | Soumettre sans achat intégré, ou ajouter l'achat intégré | Soumettre sans, repli préparé. Risque de refus réel (3.1.1) |
| IA à la première revue Apple | Ouverte ou fermée | Ouverte, avec compte de revue en offre Coach (règle 2.5.19) |
| Durée de la bêta IA | À fixer | Après 30 jours de vrais usages |
| Suppression après 24 mois d'inactivité | À valider par le juriste | Voir [conformité](reference/conformite.md) |

## Risques à garder en tête

- **HDS** : la question la plus lourde. Une réponse défavorable peut imposer de changer d'hébergeur.
- **Refus Apple 3.1.1** : l'exception 3.1.3(f) ne vise pas un outil de coaching.
- **Connexion aux prestataires jamais éprouvée** : le bug vidéo vient d'un code jamais exercé avec un vrai webhook. Considère tout ce qui n'est pas « éprouvé » ci-dessus comme suspect.
- **Sentry gratuit** : une seule sonde de crons active. La sonde de disponibilité et celle des notifications attendent une place.
- **Skew Protection** Vercel refusée par l'API : à activer à la main si l'offre l'inclut.
- **iPhone, PWA** : les notifications exigent l'ajout à l'écran d'accueil, d'où l'intérêt de l'app native.

## Hors périmètre de la V1

Reporté à une décision du fondateur. V2 : parents et mineurs, dessin et comparaison vidéo, statistiques de saut, planification de saison, bilan du matin, biométrie, PDF, tablettes, anglais. V3 : messagerie, lancers, demi-fond, montres, bibliothèque communautaire, commentaire vocal.
