# Recette de lancement du planificateur Tartan

État au 25 novembre 2026 sur la branche `test/recette-testeurs`. Les PR 187 à 194 réunissent les huit lots en Preview. La production utilise encore la version précédente. Une invitation externe engage le parcours complet, depuis l’e-mail jusqu’à la séance enregistrée sur le téléphone.

| Parcours | Codé | Testé automatiquement | Éprouvé en réel et suite à donner |
| --- | --- | --- | --- |
| Reprendre une proposition | Actions selon l’état, réponse, reprise, édition versionnée, duplication et retrait. Suppression individuelle avec contrôle de l’état du brouillon. | Tests des services et reprise entre deux onglets. 26 parcours Playwright du planificateur passent sur ordinateur et mobile avec prestataire simulé. | Faire démarrer un coach sur ordinateur, répondre sur téléphone puis vérifier la date et l’état du brouillon ouvert. |
| Préparer une semaine | Sept jours, matériel, créneaux occupés, comparaison d’ajustement, conservation des blocs et confirmation partielle rejouable. | Contrôle de concurrence, collision de créneaux et compatibilité des fiches avec le matériel. | Trois passages du moteur avec le fournisseur réel sur le corpus connu. Recette sportive par un coach et mesure sur corpus inédit ouvertes. |
| Créer pour soi | Entrées depuis l’accueil et le calendrier, retour vers le carnet personnel, destinataire identifié. | 14 tests du service de l’espace personnel, dont l’isolation et la création simultanée. | Faire réaliser le parcours par un athlète autonome et par un membre de club. |
| Bibliothèque et gestes | 60 nouvelles fiches préparées. Atelier par clé avec validations distinctes du texte, de l’image et du geste. 18 images préparées sur 233. | Contrôles des ressources et des phases. Relecture puis réouverture d’une image sur deux formats web. | Direction des silhouettes choisie. Relecture technique par fiche, production des 215 images restantes et rapprochement des 24 fiches historiques hors catalogue ouverts. |
| Encouragements | 30 mantras et 12 encouragements par ton, deux réglages indépendants, arrêt possible. | Jour de Paris, dernière série réelle, répétition d’événement, retour et circuits. | Vérifier lisibilité, minuteur, lecteur d’écran et validation sur téléphone en conditions de piste. |
| Console privée | Invitations par plateforme, lien individuel expirant, révocation, reprise des envois et contrôle d’accès au téléchargement. | Quatre parcours web de la console. Contrôles des droits et de l’état fournisseur. | Disponible en Preview sous `/admin/testeurs`. Avant ouverture, vérifier un cycle d’invitation, renvoi, retrait et réception Gmail, iCloud et Outlook. |
| iPhone | Profil de distribution et contrôle du candidat TestFlight. | Vérifications de groupe, de version et d’état dans l’intégration Apple. | Build 1.1.0 (16) livré et traité par Apple. Groupe externe nominatif créé, contact et consignes enregistrés. Compte de revue, soumission, accord d’Apple et installation sur iPhone restent à vérifier. |
| Android | Profil APK signé sur le canal bêta, stockage privé, téléchargement soumis à une invitation. | Comparaison du certificat de l’AAB 5 et de l’APK 6, contrôle des octets stockés et refus anonyme HTTP 403. | APK 1.1.0 (6) installé et ouvert sur émulateur. Installation, mise à jour avec données en attente sur téléphone et passage à Play restent ouverts. Le compte organisation Play reste à créer. |

## Qualification de l’IA

Le premier passage complet de recette utilise les 80 consignes historiques et les 150 paires exercice-terme. Les attentes sont gelées. Les trois exécutions donnent 77, 76 et 75 séances justes sur 80, sans faute classée grave. Une fiche voisine a été proposée pour un terme absent sur chacun des trois passages. Le premier résumé lisible arrive autour d’une seconde et le temps médian de la séance complète varie de 11,83 à 12,35 secondes. Le coût des trois passages, paires incluses, est de 2,38 dollars.

Le correctif qui distingue une action du pied d’un éducatif entier a été rejoué avec le fournisseur réel. La paire auparavant mal rapprochée et la séance qui la contient passent toutes deux trois fois. Le banc historique limité au fournisseur a par ailleurs donné 60/80 avec les attentes historiques sur les questions et les emplacements à compléter. Ces deux bancs mesurent des comportements différents.

Le fondateur confirme que les 40 consignes inédites et les 30 dictées humaines restent à recueillir. Le protocole de gel et les seuils se trouvent dans [le référentiel du planificateur](../reference/planificateur-ia.md). Préserver les attendus avant de les soumettre au moteur. Conserver les fichiers vocaux et les accès de revue hors du dépôt.

## Essai terrain

| Situation | Mesures à relever |
| --- | --- |
| Le coach dicte au stade et ajuste une récupération | Chronométrer du premier mot au premier brouillon utilisable. Relever les corrections, les exercices incertains, les destinataires et la variante sans barre. |
| L’athlète prépare deux jours avec corde et kettlebell | Vérifier « Pour moi », le raccourcissement du jeudi, la conservation du mardi et le lancement au calendrier. Faire exprimer les raisons d’un refus de proposition. |
| Reprise entre deux appareils | Relever le résultat d’une modification concurrente, du retour après perte de réseau et de la suppression d’un brouillon déjà publié ailleurs. |
| Installation et mise à jour | Relever le système, la version affichée, le statut d’invitation et le résultat après mise à jour avec une séance locale en attente. Un clic de téléchargement ne prouve pas une installation. |
