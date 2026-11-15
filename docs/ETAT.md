# État du projet

Mis à jour le 15 novembre 2026, après la recette en production avec les comptes du fondateur. Toute PR qui change un état met ce fichier à jour. Ce fichier est une photographie : l'historique des lots vit dans Git (`git log -p docs/ETAT.md`), les passations dans [JOURNAL.md](JOURNAL.md).

**En une phrase :** les phases A à G sont fusionnées (PR 131 à 142, gestes animés en dernier) ; la recette en production du 15 novembre a joué circuit, mode séance, vidéo, tracés et planificateur avec les comptes du fondateur et corrigé ce qu'elle a trouvé ; l'IA n'est pas qualifiée, aucun vrai paiement ni aucun téléphone physique n'a été éprouvé, et aucun binaire mobile ne peut partir tant que `EXPO_TOKEN` manque.

**Plan en cours (15 novembre), huit lots :** 1. recette en production ; 2. fin du constructeur (glisser-déposer, séries détaillées, variante par exercice) ; 3. mobile au niveau du web et Maestro Android ; 4. gestes vus de face ; 5. bêta iOS (`EXPO_TOKEN`) ; 6. IA qualifiée (plafond OpenAI, corpus du fondateur) ; 7. bêta Android (D-U-N-S) ; 8. ouverture. Les lots 1 à 4 ne dépendent que de l'agent. Plan précédent : [audit et reprise du 14 novembre](plans/web.md#audit-et-reprise-du-14-novembre-2026). Les inscriptions restent fermées jusqu'à la décision d'ouverture du fondateur.

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
| 14 nov. | Quota vidéo propre à chaque athlète : 8 par mois en Découverte, 20 en Coach et Club, hors du quota de l'espace ; maquette du constructeur validée |
| 14 nov. | Les 150 guides textuels relus et approuvés par le fondateur ; illustrations à produire |

## Ce qui tourne

| Élément | État au 14 novembre |
| --- | --- |
| Production | `app.tartan.coach` et `tartan.coach`, santé 200, aucune erreur d'exécution après les fusions du 15 novembre. Recette réelle le 15 novembre : circuit publié et rendu, vidéo envoyée et annotée, planificateur réel. Inscriptions et classement du jeu fermés |
| Preview | `preview.tartan.coach`, branche Git `preview` remise sur `main` ; base `preview` reconstruite le 14 novembre avec la seule graine de démonstration (4 comptes fictifs, 150 fiches communes), sans donnée de production |
| Neon | Offre Launch, restauration 7 jours, branche `production` protégée, calcul 0,25–2 CU ; branche `preview` 0,25–1 CU. Plus aucune branche de recette |
| GitHub | Dépôt public, `LICENSE` propriétaire ; analyse des secrets, protection à l'envoi et alertes Dependabot actives depuis le 14 novembre (aucun secret détecté, 10 alertes sur des dépendances indirectes). `main` exige `quality` et `mobile-gate` (toujours présent, vert quand le mobile n'est pas concerné). Depuis le 14 novembre, `quality` résume des jobs parallèles (contrôles, parcours en trois parts, vidéo et planificateur) au lieu d'un job d'environ 50 minutes |
| Sauvegardes | Copie chiffrée chaque nuit vers un store Vercel Blob privé, relue par empreinte ; restauration locale chronométrée réussie les 13 et 14 novembre ([sauvegarde](exploitation/sauvegarde.md)) |
| Stripe | Compte dédié Tartan, prix 19/190 € et 59/590 €, webhook de production sur 15 événements, portail configuré. Aucun vrai paiement |
| iOS | Archive 1.1.0 (12) ancienne, à reconstruire ; aucune bêta TestFlight externe |
| Android | AAB 1.1.0 (3) construit le 13 novembre ; aucun compte Play |

## Niveau de preuve par fonction

« Testé » : tests automatisés, prestataires simulés sauf mention. « Éprouvé » : constaté en production ou sur appareil réel.

| Fonction | Testé | Éprouvé | Défauts connus (audit du 14 novembre) |
| --- | --- | --- | --- |
| Connexion, onboarding, espaces, invitations | Oui | Lien magique et e-mail de bienvenue reçus sur Gmail | Compte neuf et invitation jamais joués par une vraie personne ; Outlook et iCloud non éprouvés |
| Séances V2 (circuits, groupes, récupérations) | Oui | Sur le web, par l'agent | Corrigé le 14 novembre (phase B) : récupérations hors de la saisie des séries, ordre des blocs communs en autonomie, références conservées hors des groupes (une ancienne séance réenregistrée garde ses coches), séries précédentes dans l'ordre des tours. Reste : séries × tours sans aide dans le constructeur (phase C) |
| Constructeur web | Oui | Sur le web local, par l'agent | Refait le 14 novembre selon la maquette validée (phase C) : sélecteur unique avec recherche et familles nommées, « Ajouter ici » à chaque niveau, la bibliothèque ajoute à la destination choisie, regroupement d'une sélection, déplacement dans et hors d'un groupe (« Autres actions », et glisser-déposer à la poignée depuis le 15 novembre, au doigt comme à la souris ; sur téléphone, monter et descendre passent dans le menu), une série par tour à l'entrée d'un groupe, résumé « tours × séries », pictogramme sur tuile colorée par famille (jamais de bordure latérale, interdite par `DESIGN.md`), cadre de groupe. Séries détaillées depuis le 15 novembre (« Détailler série par série » : répétitions, charge et échauffement par série, montrés série par série dans le mode séance et proposés à la saisie ; le mobile les lit dans le résumé). Reste : variante par nœud au lieu de deux listes, même refonte sur le mobile |
| Mode séance | Oui | Sur le web local, par l'agent | Refait le 14 novembre : minuteur calé sur l'horloge, récupération lancée à la série cochée et à l'arrivée sur une récupération de circuit, enchaînement automatique, vibration, signal sonore et annonce, écran gardé allumé, aperçu de l'étape suivante, progression continue. Reste : notification locale sur le mobile natif |
| Catalogue et guides | Oui | 150 fiches comptées en production | Corrigé le 14 novembre (catalogue version 4, à relire par le fondateur ; la v4 ajoute « Marche dans les escaliers » aux synonymes des montées d'escaliers) : « Arraché musclé » au lieu d'« Arraché en force », consigne de lâcher de barre sur six mouvements olympiques, dos arrondi au soulevé de terre, mention « consignes indicatives » sur chaque guide et dans les conditions d'utilisation. Phase E (PR `feat/illustrations`) : 133 gestes animés sur 150, lus d'après la fiche commune à l'affichage, donc aussi dans les séances déjà publiées ; web et mobile, frise en mouvement réduit ; atelier `/admin/mouvements` et validation par famille. E3 (PR `feat/catalogue-variantes`) : catalogue version 5, 173 fiches dont 23 variantes (jeté poussé, équilibre d'arraché, Nordic, swing, skipping B, passages de haies, départs accroupis…), guides marqués « en préparation » jusqu'à la relecture du fondateur, 156 gestes ; une copie renommée ou complétée par le coach garde son guide, sauf changement de type de mouvement. Reste : 17 exercices qui se lisent de face, relecture du fondateur |
| Planificateur IA | Oui, prestataire simulé | Un parcours réel complet sur serveur isolé | Corrigé le 14 novembre : contrôles actifs après une question ; « Proposer » couvre tous les destinataires. Phase D, première partie : un nom de mouvement absent de la bibliothèque devient une question nommée sans appel au modèle (passe déterministe mesurée sur les 140 cas figés : les 10 noms inconnus repérés, aucune question à tort) ; plus de choix d'une fiche par un mot isolé ; « Ajuster » après une proposition, sans quota ; exercices et séries visibles avant « Relire » ; « Remplacer » garde la prescription ; recherche libre et consignes facultatives dans la question d'exercice ; choisir une fiche existante ne demande plus le droit de modifier la bibliothèque ; dictée nourrie des noms de la bibliothèque. Reste : qualification réelle sur un corpus écrit par un coach, deux appels au modèle, aucun réglage du modèle mesuré |
| Vidéo collaborative | Oui | Uploads, lecture et droits sur Mux Preview | Corrigé le 14 novembre : un camarade voit la vidéo partagée et les remarques de son auteur seulement, sans pouvoir annoter ; « À travailler » ne reprend qu'une remarque de coach ; l'athlète ne supprime que ce qu'il a envoyé ; plus d'essai de saut déclaré par l'athlète. Quota propre à chaque athlète (8 ou 20 par mois), ses envois hors du quota de l'espace. Phase F2 (PR `feat/mes-videos`) : `/mes-sauts` devient `/mes-videos` (redirection permanente, liens universels et notifications mobiles acceptent les deux), phases génériques (préparation, exécution, fin du geste) hors des outils de hauteur, notification nommant l'athlète qui envoie ou le coach qui partage, filtre par groupe. Tracés (PR `feat/traces-video`) : ligne, flèche, angle mesuré et cercle posés sur l'image arrêtée, avec ou sans texte, enregistrés avec les proportions de l'image ; affichés à l'instant de leur remarque sur le web et le mobile (lecture seule sur mobile) |
| Charges, records, progression, phases | Oui | Partiel, sur le web | — |
| Notifications, e-mails | Oui | Gmail seulement ; aucun push réel | — |
| Abonnements Stripe | Oui, et six tests sandbox réels dans le navigateur | Aucun vrai paiement | Retour vers Tartan après paiement non prouvé |
| Hors ligne, PWA | Oui | Pas au stade | — |
| Mobile natif | Oui, et parcours Maestro iOS sur simulateur | Aucun téléphone physique | Corrigé le 14 novembre : file d'envoi vidéo rattachée au compte, arrêt sur session expirée. G1 (PR `feat/mobile-g1`) : mise à jour à distance avec la variante, l'API et le canal du profil (`scripts/profile-env.mjs`), canal `beta` séparé, version d'exécution par empreinte native, `webcredentials` iOS, lint mobile (textes et couleurs en dur, hooks). Parité (PR `feat/mobile-parite`) : motif d'absence facultatif, série de régularité, partage de la carte de record (`expo-sharing`, nouveau module natif : il faut un nouveau binaire). Reste : Maestro Android ; cartes de sources Sentry (jeton à créer) |

## Portes d'ouverture

Détail : [commercialisation](plans/commercialisation.md).

| Porte | État |
| --- | --- |
| 1. Juriste | Franchie sur déclaration du fondateur (14 nov.) |
| 2. Médiateur, CGV | Médiateur différé par décision du fondateur ; depuis la phase B, ni mention « version de travail » ni repère `[À DÉFINIR]` : les CGV disent que les coordonnées du médiateur viendront à l'adhésion |
| 3. OpenAI | Accord de traitement accepté ; clé conservée par décision, plafond de dépense à poser |
| 4. Vrai paiement | Ouverte |
| 5. Configuration | Webhooks Stripe et Resend éprouvés ; sondes et passkey de secours restantes |
| 6. Mux, Neon, sauvegardes | Franchie : Neon Launch, sauvegardes privées restaurées, aucun plafond technique Mux (`MUX_VIDEO_LIMIT=0`, relu le 14 novembre), quotas des offres seuls |
| 7. E-mails | Gmail fait ; Outlook et iCloud restants |
| 8. Téléphones | Ouverte |
| 9. Compte neuf sans aide | Ouverte |
| 10. Tests critiques | Franchie le 11 novembre |

**Matrice des écrans (F1, PR `test/matrice-ecrans`)** : les 74 pages listées avec leurs rôles et leurs preuves (`apps/web/e2e/screens.ts`), un test qui refuse toute page hors matrice, et un balayage visiteur, coach et athlète à 390, 768 et 1440 px (axe, débordement, erreur). Écrans sans parcours propre avant F1, désormais couverts par le balayage : `/analyse`, `/nouveautes`, `/synchronisation`, `/reglages/references-force`, une fiche d'exercice, un historique d'athlète. L'accord parental et les liens d'e-mail ne sont prouvés que par des tests serveur.

## Ce qui revient au fondateur

1. Installer la bêta TestFlight sur ton iPhone (build 14, version 1.1.0, envoyé à App Store Connect le 15 novembre ; `EXPO_TOKEN` et la clé App Store Connect `SJHW52VCAC` sont posés) et rejouer une séance d'athlète, notification comprise.
1. Créer un jeton Sentry (portée `project:releases`) et le poser sur EAS (`eas env:create --name SENTRY_AUTH_TOKEN --visibility secret`), pour envoyer les cartes de sources des binaires ; l'agent retirera ensuite `SENTRY_DISABLE_AUTO_UPLOAD`.
2. Poser un plafond de dépense mensuel sur le projet OpenAI.
3. Créer une passkey de secours sur un second appareil, avant le retrait de `ADMIN_BOOTSTRAP_TOKEN`.
4. Recevoir le D-U-N-S, puis créer le compte Google Play organisation (identité, paiement, contrat).
5. Relire les retouches des guides (phase B), relire les 23 nouveaux guides de la version 5 (`packages/domain/src/exercise-catalog/variants.ts`) et valider les gestes famille par famille dans `/admin/mouvements` (phase E) : sans validation, l'athlète les voit déjà, avec la mention « Illustration de travail ».
6. Écrire, ou faire écrire par un coach, 40 consignes de planification jamais vues par l'agent, et enregistrer 30 dictées (phase D).
7. Le paiement réel accompagné, les e-mails sur Outlook et iCloud, la recette sur ses téléphones, le pilote sans guidage, puis la décision d'ouverture (phase F).

Le mot de passe des comptes de démonstration de la Preview est dans `.local/preview-demo-password`, sur le poste de l'agent qui l'a créé, jamais dans le dépôt.

## Décisions ouvertes

| Sujet | Recommandation |
| --- | --- |
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
