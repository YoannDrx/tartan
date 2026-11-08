# Une célébration par séance validée

Développement du 8 novembre 2026 depuis `aebebe9`, PR #45 en brouillon. La preuve porte sur le commit contenant ce fichier, en environnement local isolé. Pas de déploiement ni d'activation en production.

## Comportement

La première validation complète revendique un accusé de célébration dans la même transaction que la réalisation. Le marqueur persistant ne s'efface pas lors d'une correction, d'un passage en partiel ou d'une nouvelle validation. Deux demandes concurrentes ne peuvent obtenir deux accusés. Une validation du coach revendique aussi le marqueur, mais ne produit pas d'animation chez lui ni lors d'une consultation ultérieure par l'athlète.

L'accusé contient les records actuels de cette séance, y compris ceux déjà saisis pendant sa réalisation partielle. Une première référence et une égalité ne comptent pas comme record. Le web et le natif enrichissent leur animation existante avec le nombre de records, puis gardent une synthèse textuelle. Les records ne créent aucune animation supplémentaire dans l'historique, aucun son et aucune notification.

L'interface anime seulement une réponse directe, valide et non rejouée. Une réponse perdue ou un envoi hors ligne peut donc ne produire aucune animation ; sa synchronisation ne la rejoue pas. Le statut et les records courants restent consultables. La réduction des animations empêche le lancement, et son activation pendant la célébration arrête celle-ci. Les informations demeurent dans un encart accessible.

## Migration et compatibilité

La migration `20261108020000_session_celebration` ajoute une colonne nullable à `session_logs`. Elle marque les validations anciennes déjà terminées avec leur date de validation, ou de création si absente ; les anciennes validations partielles restent éligibles à leur première validation complète. Aucun historique de séries n'est modifié. Les anciens clients ignorent le nouveau champ ; leur animation locale ancienne n'est pas modifiable par cette évolution serveur.

La migration a été appliquée sur les bases locales jetables de tests et de parcours navigateur. Un test SQL sur table temporaire reproduit les trois états anciens. Après l'envoi de `9ea0639`, elle a aussi été appliquée sur la Preview isolée `br-floral-sun-b9iar8ge` : 28 → 29 migrations en 2,52 s, colonne relue, zéro compte et aucun drapeau activé. Le contrôle préalable du nombre de migrations a interrompu sans mutation un premier lancement dont le compteur attendu était incorrect ; le lancement corrigé a réussi. Aucune migration exécutée en production.

## Vérification

- 28 tests serveur ciblés : migration, données réalisées, records, transition partiel → complet, concurrence, rejeu, correction et validation coach ; aucune deuxième célébration.
- 124 tests métier et 201 tests mobiles réussis ; accusés obsolètes, rejoués ou mal formés refusés.
- Six parcours navigateur sur build de production, desktop et web mobile : validation des séries, records, réouverture, correction du statut, hors ligne et synchronisation ; animations normales et réduites. Contrôle Axe et absence de débordement.
- Types du monorepo, lint (zéro erreur, quatre avertissements préexistants), design check et exports Hermes iOS/Android réussis.
- Capture mobile relue : résumé des deux records, convention et unité visibles, contenu accessible sans animation. UI/UX Pro Max : information persistante ; Frontend Design : reprise du composant de validation existant ; revue React : animation déclenchée par accusé, nettoyage des minuteries et écouteurs.

La recette native visuelle attend l'accès au Mac déverrouillé. Les exports Hermes ne prouvent ni l'affichage natif ni le comportement sur appareil physique. Les performances athlé typées et leur règle explicite de comparaison restent à livrer.

[Confirmation web mobile](images/celebration-records-mobile.png).
