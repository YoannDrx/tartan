# Lot E — capture native de dictée, 8 novembre 2026

État : socle et composant natifs codés, intégration au parcours complet encore ouverte. IA toujours désactivée en production ; aucune capture réelle de coach ni validation sur téléphone physique dans ce lot.

## Changements

- `expo-audio` 55.0.18 installé et configuré sur iOS/Android. Micro partagé avec la capture vidéo, sans service de capture ou lecture en arrière-plan. Version native 1.1.0 : le runtime `appVersion` empêche une OTA audio sur les anciens binaires 1.0.0.
- Capture mono AAC, 16 kHz / 32 kbit/s demandés au système. Arrêt natif à 179 secondes, une seconde de marge pour l’amorce du codec ; contrôle serveur conservé à 180 secondes et 3 Mio. Le composant arrête/transcrit aussi à cette limite tant qu’il reste au premier plan. Les propriétés effectivement produites par chaque téléphone restent à mesurer.
- Consentement explicite avant demande du micro, explication que le prestataire reçoit l’audio prononcé et invitation à ne citer ni identité ni donnée de santé. La transcription doit ensuite être relue dans le parcours de planification.
- Cycle unique : permission → capture → arrêt → transcription → nettoyage. Doubles appuis dédupliqués. Annulation pendant permission, arrêt ou réseau ; résultat tardif ignoré. Arrière-plan, interruption après préparation, démontage et déconnexion annulent la capture/l’envoi local. Une requête déjà reçue par le serveur peut finir selon son cycle durable ; annuler localement ne prétend pas annuler le traitement prestataire.
- Fichier temporaire supprimé après succès, échec ou annulation. Aucun audio dans AsyncStorage, la file hors ligne ou les vidéos. Nettoyage de reprise au démarrage et avant la capture, limité aux noms `recording-*.tartan.m4a` dans les emplacements de cache Expo iOS/Android. Un nettoyage impossible est visible et interdit une nouvelle capture tant qu’il échoue.
- Envoi multipart avec référence de fichier React Native, sans conversion base64. Délai réseau de deux minutes, signal d’annulation transmis par le SDK. Une réponse perdue peut être consultée par identifiant sans renvoyer l’audio ni lancer une seconde transcription. Cet identifiant n’est conservé qu’en mémoire dans ce composant.

## Preuves automatisées

- 15 tests ciblés natifs : permission refusée, double capture/envoi, fermeture pendant permission, arrière-plan, annulation pendant arrêt/envoi, réponse tardive, fichier vide/surdimensionné, échec réseau, échec de suppression, protection du fichier actif et conservation des autres médias.
- Suite native complète : 218 tests réussis dans 31 fichiers ; vérification TypeScript de tous les paquets réussie.
- 4 tests API/SDK réussis, dont le transport multipart annulable sans reprise automatique. Les trois autres couvrent les accès et le parcours authentifié, dont la transcription durable.
- Configuration Expo publique résolue : version 1.1.0, plugin audio présent, arrière-plan désactivé. Prebuild iOS et installation CocoaPods réussis ; ExpoAudio figure dans le graphe natif.
- Compilation Xcode iOS réussie, zéro erreur et cinq avertissements de dépendances/scripts existants. Binaire de développement installé sur l’iPhone 17 Pro simulé, puis ouverture explicite du serveur Metro Tartan sur 8083 (statut `running`). L’API dédiée 3102 reste disponible. Cette compilation n’est pas un build de distribution TestFlight.
- Exports Hermes iOS et Android réussis ; `design:check` : aucun travers détecté.
- CI du prédécesseur poussé `d1df20f` : qualité `42449500250` et compilation Android `42449500262` réussies ; Preview Vercel prête. Ces résultats ne valent pas validation du nouveau code de capture.
- La CI Android `42451584082` sur `752417c` a échoué au diagnostic, avant compilation : `expo-asset`, dépendance native requise par ExpoAudio, n’était déclaré qu’indirectement. Ajout direct de la version SDK 55 et de son plugin. Le diagnostic local `expo-doctor` passe ensuite ses 20 contrôles sur 20 ; la compilation CI corrigée reste à observer.

## Limites et suite

Le composant `PlannerDictation` n’est pas encore raccordé à un écran de planificateur. Le parcours web/natif de choix, relecture, clarifications et modification des propositions reste à terminer. Le simulateur iPhone 17 Pro a été relancé et l’API locale répond 200, mais le contrôle visuel signale le Mac verrouillé.

Les 15 tests de cycle utilisent des adaptateurs simulés : ils ne prouvent ni la qualité du micro, ni le format AAC effectivement produit, ni les interruptions système sur téléphone. Recette iPhone/Android physiques et corpus de dictées restent obligatoires avant activation. La configuration de consentement, traitement prestataire et conservation doit encore être examinée pour la commercialisation.

Référence SDK consultée : [Expo Audio SDK 55](https://docs.expo.dev/versions/v55.0.0/sdk/audio/). Les options de constructeur, les chemins de cache et le comportement d’arrêt ont été vérifiés aussi dans la source installée 55.0.18.
