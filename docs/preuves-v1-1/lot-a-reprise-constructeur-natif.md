# Reprise du constructeur natif

Preuves du 8 novembre 2026 (Europe/Paris), lot fondé sur `3329e86`, livré dans la PR #45 en brouillon et non déployé en production. La CI qualité de `3329e86` est verte ; son contrôle Android a échoué sur la déclaration de version React Navigation. La déclaration est alignée sur Expo, sans changement de version résolue ; Expo Doctor passe ses 20 contrôles. La CI de ce lot doit encore être observée.

## Comportement implémenté

- Brouillon isolé par compte, espace et séance, stocké dans SecureStore en générations atomiques. Les écritures et suppressions vérifient la révision pour préserver une saisie concurrente.
- Conservation des champs incomplets, des prescriptions non encore appliquées et de l'identifiant serveur reçu avant publication. Une création dont la réponse est inconnue n'est pas renvoyée automatiquement.
- Relecture local/serveur et confirmation avant reprise. Aucune écriture serveur pendant ce choix ; la version serveur doit être vérifiée avant l'enregistrement.
- Reprise hors ligne depuis le contexte sauvegardé ; refus d'envoi tant que la version courante n'a pas été relue. Un refus d'accès serveur ne donne pas accès à une copie de secours.
- Expiration logique après sept jours depuis la dernière sauvegarde, avec suppression lors de la prochaine lecture. Cela ne prouve pas une purge physique de toutes les copies jamais rouvertes.

## Validation automatique

198 tests mobiles réussis, typage monorepo réussi avant la correction finale du chargement, puis typage mobile et les 198 tests réussis après celle-ci. Exports Hermes iOS et Android réussis après la correction de cache ; formatage et contrôle design réussis. Les tests couvrent notamment les écritures concurrentes, panne de stockage, nettoyage tardif, réponse réseau perdue, publication échouée et prescription non appliquée. Aucun test serveur supplémentaire : ce lot ne change pas les services serveur.

## Recette interactive iOS

Environnement : iPhone 17 Pro simulé, iOS 26.3, client `coach.tartan.app.dev`, Metro 8083, API locale 3102 et base synthétique `tartan_v11_e2e`. Aucun compte de production ni notification externe utilisés.

1. Connexion d'un coach synthétique, calendrier et ouverture du constructeur réussies.
2. Saisie du titre « Recette reprise native » et sélection du groupe ; confirmation de conservation locale avant retour au calendrier.
3. Première réouverture : défaut reproduit. React Query réutilisait les données de la visite précédente et initialisait le formulaire vide avant la lecture du brouillon. La copie stockée restait présente.
4. Correction : clé de requête propre à chaque visite, cache supprimé une fois inactif. La nouvelle visite attend la lecture du stockage et du serveur avant de monter l'éditeur.
5. Reprise confirmée : titre et groupe restaurés. Nouveau retour au calendrier puis réouverture sans rechargement du code : le résumé du brouillon est bien proposé.
6. Arrêt complet du client de développement puis relance : session reconnue, retour au calendrier et brouillon toujours proposé avec titre, date, groupe et blocs.

La recette ne couvre pas encore la publication complète depuis l'écran natif, les prescriptions individuelles, les interruptions réseau sur appareil, VoiceOver/TalkBack ou un téléphone physique. Elle ne constitue pas un build signé pour les stores.
