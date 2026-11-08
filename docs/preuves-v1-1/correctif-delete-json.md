# Corps JSON des suppressions natives

Vérification du 8 novembre 2026, PR #45. La version installée de `next-zod-route` ignore le corps des requêtes DELETE. Les routes `devices` et `blocks` déclaraient pourtant un schéma de corps : elles répondaient 400 avant de détacher un jeton ou de débloquer un utilisateur. Le défaut a été identifié pendant la recette HTTP des performances, puis confirmé dans le code de la bibliothèque et les deux routes existantes.

Les deux handlers authentifiés lisent et valident maintenant explicitement le JSON. Le format utilisé par les applications en circulation reste inchangé ; aucun jeton push n'est déplacé dans l'URL. Les schémas refusent les valeurs invalides. L'acteur provient toujours de la session, jamais du corps, et les services conservent le filtre propriétaire lors de la suppression.

Deux parcours sur build de production (desktop et web mobile) vérifient : enregistrement d'un jeton fictif via le client API natif partagé, retrait par un autre compte sans effet, retrait par le bon compte, rejeu, corps invalide, appel sans session, blocage puis déblocage et absence d'effet du compte tiers. Les lignes Postgres sont relues pour prouver l'effet réel. Les quatre parcours groupés avec les performances passent en 32,2 s.

Ce test n'envoie aucun push et ne remplace pas une réception APNs/FCM sur appareil physique. La désinscription du jeton côté OS demeure couverte par les tests existants du cycle de déconnexion natif. Aucun déploiement de ce correctif en production n'est revendiqué par cette preuve.
