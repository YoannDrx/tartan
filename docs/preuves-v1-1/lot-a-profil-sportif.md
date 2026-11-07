# Profil de préparation physique — 8 novembre 2026

Lot A de la PR #45, développé depuis `079418d`. Le coach choisit ses disciplines, objectifs de préparation et matériel à la création, puis peut les modifier dans les réglages web et natifs. Ces choix sont facultatifs, sans saut en hauteur présélectionné. L’objectif du premier groupe est enregistré avec sa création. Les anciennes disciplines libres restent conservées.

Les trois listes se déplient sur demande et montrent un résumé de la sélection. Les composants sont partagés entre création et réglages sur chaque plateforme. Revue UI/UX Pro Max : champs facultatifs, choix progressif et libellés explicites ; Frontend Design : accueil expressif, réglages clairs et compacts ; Impeccable : zéro travers détecté. Captures examinées : aucune action masquée ni débordement constaté. La date au format américain dans les captures vient du navigateur de test ; la donnée transmise reste ISO.

## Accès et compatibilité

Le contrat commun valide les options, déduplique les listes et conserve les champs omis par un ancien client. Une liste explicitement vide permet de retirer une sélection. Les lectures et écritures passent par les services avec contrôle d’appartenance ; seul le propriétaire modifie les réglages. L’API native ne renvoie que les champs utiles de l’espace, sans moyen de paiement ni secret.

Migration additive `20261108010000_training_profile` : deux tableaux de chaînes, vides par défaut. Aucune transformation des disciplines existantes. Migration sur copie locale de l’ancien schéma synthétique : 27 → 28 migrations en 0,85 s, identités et choix des deux espaces conservés ; second passage sans travail restant. Bases vierges couvertes par les réinitialisations des tests. Le diff Prisma ne signale aucune divergence concernant ces nouvelles colonnes ; quatre écarts antérieurs (clé étrangère et valeurs par défaut) restent hors de ce lot.

Preview Neon `br-floral-sun-b9iar8ge` : migration 27 → 28 en 2,27 s, lecture indépendante confirmant les deux colonnes et zéro compte. Aucun flag activé. Production non modifiée.

## Preuves locales

- **516 tests serveur réussis**, dont cinq nouveaux cas de profil : création sans spécialité imposée, persistance, compatibilité ancien client, retrait explicite et refus d’accès/valeurs invalides.
- **Deux parcours navigateur réussis**, desktop et mobile, sur build de production : inscription et confirmation d’âge, création de groupe/profil, modification et rechargement, appels API compatibles, refus athlète. Axe, 390/768/1440 px et zoom 200 %, sans débordement.
- **199 tests mobiles**, types du monorepo, lint sans erreur (quatre avertissements préexistants), design sans travers et exports Hermes iOS/Android réussis.
- Simulateur iPhone 17 Pro, iOS 26.3 : connexion au compte synthétique créé sur web, ouverture des réglages sportifs, lecture des choix web, ajout de Mobilité, sauvegarde, retour et réouverture. Sélection conservée, confirmée par lecture SQL. Aucun téléphone physique, VoiceOver/TalkBack ou nouvel onboarding natif complet revendiqué.

La suite serveur a révélé une assertion d’export instable : rechercher la sous-chaîne « 199 » dans tout le JSON pouvait correspondre à un UUID aléatoire. L’assertion vérifie désormais précisément les tests autorisés et les identifiants exclus. Le code d’export n’a pas changé. Un premier essai de la nouvelle assertion attendait un champ absent et un nombre non sérialisé ; corrigé, puis huit tests ciblés et les 516 tests complets réussis. Le nouveau parcours navigateur a également remplacé le nom de groupe codé en dur du helper par un paramètre, avec défaut conservé pour les anciens tests.

[Onboarding mobile](images/training-onboarding-mobile.png) · [Réglages desktop](images/training-settings-desktop.png)

Ce lot ne termine pas la bibliothèque relue, les parcours de progression, les phases ou l’IA. La PR reste en brouillon ; les deux crashs de développement iOS documentés au lot vidéo restent à isoler.
