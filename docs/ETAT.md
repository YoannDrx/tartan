# État du projet

Mis à jour le 14 novembre 2026, après l'audit du travail de finalisation. Toute PR qui change un état met ce fichier à jour. Ce fichier est une photographie : l'historique des lots vit dans Git (`git log -p docs/ETAT.md`), les passations dans [JOURNAL.md](JOURNAL.md).

**En une phrase :** la production sert `8b64713` et la CI est verte ; constructeur à circuits, 150 guides, deux modes IA et vidéo collaborative sont codés et testés, mais neuf défauts bloquent encore la vente, l'IA n'est pas qualifiée, aucun vrai paiement ni aucun téléphone physique n'a été éprouvé, et aucun binaire mobile ne peut partir tant que `EXPO_TOKEN` manque.

**Plan en cours :** [audit et reprise du 14 novembre](plans/web.md#audit-et-reprise-du-14-novembre-2026), phases A à G. Les inscriptions restent fermées jusqu'à la décision d'ouverture du fondateur.

## Décisions du fondateur en vigueur

| Date | Décision |
| --- | --- |
| 13 nov. | Avant la vente : constructeur à circuits, 150 exercices avec guides et visuels, planificateur à deux modes, vidéo collaborative ([PRODUCT.md](../PRODUCT.md)) |
| 13 nov. | Google Play : compte organisation (D-U-N-S demandé le 14 novembre via Apple, numéro pas encore attribué) |
| 13 nov. | Clé OpenAI actuelle conservée volontairement : risque non clos, plafond de dépense à poser |
| 14 nov. | Ouverture sans médiateur pour l'instant, risque accepté ; CGV à compléter à l'adhésion |
| 14 nov. | Accords de traitement acceptés chez tous les prestataires ; avis du juriste obtenu (HDS, Mux aux États-Unis, partage au groupe compris), preuve gardée hors du dépôt |
| 14 nov. | Micro-entreprise non assujettie à la TVA (293 B) ; Stripe Tax reste coupé |
| 14 nov. | Guides marqués « consignes indicatives » ; tracés sur vidéo dans le périmètre de cette version |
| 14 nov. | Les 150 guides textuels relus et approuvés par le fondateur ; illustrations à produire |

## Ce qui tourne

| Élément | État au 14 novembre |
| --- | --- |
| Production | `app.tartan.coach` et `tartan.coach`, commit `8b64713`, santé 200. Inscriptions et classement du jeu fermés |
| Preview | `preview.tartan.coach`, branche Git `preview` remise sur `main` ; base `preview` reconstruite le 14 novembre avec la seule graine de démonstration (4 comptes fictifs, 150 fiches communes), sans donnée de production |
| Neon | Offre Launch, restauration 7 jours, branche `production` protégée, calcul 0,25–2 CU ; branche `preview` 0,25–1 CU. Plus aucune branche de recette |
| GitHub | Dépôt public, `LICENSE` propriétaire ; analyse des secrets, protection à l'envoi et alertes Dependabot actives depuis le 14 novembre (aucun secret détecté, 10 alertes sur des dépendances indirectes). `main` exige `quality` ; `mobile-gate` à exiger après la fusion de la PR de phase A |
| Sauvegardes | Copie chiffrée chaque nuit vers un store Vercel Blob privé, relue par empreinte ; restauration locale chronométrée réussie les 13 et 14 novembre ([sauvegarde](exploitation/sauvegarde.md)) |
| Stripe | Compte dédié Tartan, prix 19/190 € et 59/590 €, webhook de production sur 15 événements, portail configuré. Aucun vrai paiement |
| iOS | Archive 1.1.0 (12) ancienne, à reconstruire ; aucune bêta TestFlight externe |
| Android | AAB 1.1.0 (3) construit le 13 novembre ; aucun compte Play |

## Niveau de preuve par fonction

« Testé » : tests automatisés, prestataires simulés sauf mention. « Éprouvé » : constaté en production ou sur appareil réel.

| Fonction | Testé | Éprouvé | Défauts connus (audit du 14 novembre) |
| --- | --- | --- | --- |
| Connexion, onboarding, espaces, invitations | Oui | Lien magique et e-mail de bienvenue reçus sur Gmail | Compte neuf et invitation jamais joués par une vraie personne ; Outlook et iCloud non éprouvés |
| Séances V2 (circuits, groupes, récupérations) | Oui | Sur le web, par l'agent | Récupérations proposées à la saisie des séries (rejet de l'enregistrement) ; séries × tours sans aide ; conversion silencieuse d'une ancienne séance en V2 ; ordre des blocs communs en autonomie ; séries précédentes mal triées au-delà de 9 tours |
| Constructeur web | Oui | Non | Pas de regroupement d'une sélection ni de déplacement dans ou hors d'un groupe ; le « + » de la bibliothèque ignore le groupe visé ; liste de 175 exercices sans recherche dans un groupe ; cartes sans couleur de catégorie |
| Mode séance | Oui | Non | Minuteur qui dérive et s'arrête en arrière-plan, pas d'enchaînement automatique ni d'aperçu de l'étape suivante |
| Catalogue et guides | Oui | 150 fiches comptées en production | Aucune illustration ; « Guide validé techniquement » affiché quand même ; « Arraché en force » mal nommé ; dos arrondi et lâcher de barre absents ; guide figé dans les séances publiées |
| Planificateur IA | Oui, prestataire simulé | Un parcours réel complet sur serveur isolé | 82,5 % sur un corpus de 80 cas qui a servi au réglage ; mode « Proposer » sans contrôle ; contrôles coupés après une question ; pas d'« Ajuster » ; dictée sans les noms de la bibliothèque |
| Vidéo collaborative | Oui | Uploads, lecture et droits sur Mux Preview | Quota commun à l'espace ; camarades qui annotent et lisent les remarques du coach ; « À travailler » qui reprend toute remarque ; l'athlète peut supprimer une vidéo du coach ; tracés non exposés |
| Charges, records, progression, phases | Oui | Partiel, sur le web | — |
| Notifications, e-mails | Oui | Gmail seulement ; aucun push réel | — |
| Abonnements Stripe | Oui, et six tests sandbox réels dans le navigateur | Aucun vrai paiement | Retour vers Tartan après paiement non prouvé |
| Hors ligne, PWA | Oui | Pas au stade | — |
| Mobile natif | Oui, et parcours Maestro iOS sur simulateur | Aucun téléphone physique | File d'envoi vidéo non rattachée au compte ; motif d'absence, régularité et carte de record absents ; pas de lint ni de Maestro Android ; OTA sans variante ni environnement |

## Portes d'ouverture

Détail : [commercialisation](plans/commercialisation.md).

| Porte | État |
| --- | --- |
| 1. Juriste | Franchie sur déclaration du fondateur (14 nov.) |
| 2. Médiateur, CGV | Médiateur différé par décision du fondateur ; mention « version de travail » et repère `[À DÉFINIR]` des CGV encore à traiter |
| 3. OpenAI | Accord de traitement accepté ; clé conservée par décision, plafond de dépense à poser |
| 4. Vrai paiement | Ouverte |
| 5. Configuration | Webhooks Stripe et Resend éprouvés ; sondes et passkey de secours restantes |
| 6. Mux, Neon, sauvegardes | Franchie : Neon Launch, sauvegardes privées restaurées, aucun plafond technique Mux (`MUX_VIDEO_LIMIT=0`, relu le 14 novembre), quotas des offres seuls |
| 7. E-mails | Gmail fait ; Outlook et iCloud restants |
| 8. Téléphones | Ouverte |
| 9. Compte neuf sans aide | Ouverte |
| 10. Tests critiques | Franchie le 11 novembre |

## Ce qui revient au fondateur

1. Créer un jeton robot Expo et le poser : `gh secret set EXPO_TOKEN`.
2. Poser un plafond de dépense mensuel sur le projet OpenAI.
3. Créer une passkey de secours sur un second appareil, avant le retrait de `ADMIN_BOOTSTRAP_TOKEN`.
4. Recevoir le D-U-N-S, puis créer le compte Google Play organisation (identité, paiement, contrat).
5. Relire les retouches des guides (phase B) et valider les illustrations par famille (phase E).
6. Écrire, ou faire écrire par un coach, 40 consignes de planification jamais vues par l'agent, et enregistrer 30 dictées (phase D).
7. Le paiement réel accompagné, les e-mails sur Outlook et iCloud, la recette sur ses téléphones, le pilote sans guidage, puis la décision d'ouverture (phase F).

Le mot de passe des comptes de démonstration de la Preview est dans `.local/preview-demo-password`, sur le poste de l'agent qui l'a créé, jamais dans le dépôt.

## Décisions ouvertes

| Sujet | Recommandation |
| --- | --- |
| Quota vidéo par athlète en plus du quota d'espace | Proposé : 8 par mois en Découverte, 20 en Coach et Club. À confirmer avant le lot B5 |
| Abonnement web face à Apple (3.1.1) | Soumettre sans achat intégré, repli préparé |
| IA à la première revue Apple | Ouverte, compte de revue en offre Coach (2.5.19) |
| Choix du modèle IA | Après la qualification de la phase D, coût compris |
| Mise en veille du calcul Neon de production | Gardée (5 min) ; la désactiver coûte environ 25 $ par mois et supprime le temps de réveil |
| Classement du jeu ouvert à tous | Le fondateur l'ouvre quand il le souhaite |

## Risques à garder en tête

- **Clé OpenAI anciennement exposée**, conservée par décision : sans plafond de dépense, un abus se paierait.
- **Opérations Neon** : la panne du 13 novembre vient d'une restauration finalisée sur la production ([incident](exploitation/incident.md#incidents-passés)). Jamais de finalisation hors sinistre.
- **Refus Apple 3.1.1** : l'exception 3.1.3(f) ne vise pas un outil de coaching.
- **Webhook Stripe** : factures, remboursements et litiges ne passent par la route que dans la recette sandbox, hors CI. La route RevenueCat ne répond pas explicitement en cas de panne.
- **Sentry gratuit** : une seule sonde de crons ; la sonde de disponibilité est assurée par `surveillance.yml`.
- **Textes en dur hérités** : 267 textes gelés dans `apps/web/eslint-suppressions.json`. Le mobile n'a pas de lint.
- **Jeu public** : le rejeu serveur ne prouve pas qu'un humain a joué ; le classement demande une modération.

## Hors périmètre de la V1

La liste est dans [PRODUCT.md](../PRODUCT.md#hors-périmètre). Tout ajout passe par une décision du fondateur, consignée là-bas.
