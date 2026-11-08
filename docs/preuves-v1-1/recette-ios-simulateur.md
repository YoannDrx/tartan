# Recette native sur simulateur iOS — 8 novembre 2026

iPhone 17 Pro, iOS 26.3, build de développement Tartan Dev sur Metro. API locale sur une base jetable avec progression, phases et IA activées. Aucun téléphone physique, aucune clé de prestataire.

## Parcours joués

| Parcours                                                                                  | Résultat                |
| ----------------------------------------------------------------------------------------- | ----------------------- |
| Connexion athlète et coach                                                                | Réussi                  |
| Accueil athlète, mode séance, charge individuelle (80 % de 100 kg = 80 kg)                | Réussi                  |
| Saisie des séries, puis enregistrement : 2 × 5 × 80 kg = 800 kg en base                   | Réussi après correctifs |
| Analyse : réalisé 800 kg, prévu non renseigné pour une ancienne fiche, couverture visible | Réussi                  |
| Suivi du groupe, calendrier coach, ouverture du constructeur                              | Réussi                  |
| Création d'une phase privée, « Semaine 1 sur 12 », actions de partage                     | Réussi                  |
| Planificateur : ouverture, quotas 30 propositions / 60 minutes, formulaire                | Réussi                  |

## Défauts trouvés et corrigés

- Une série occupait près d'un écran. La saisie est compactée, avec une vraie case à cocher et les réglages rares repliés, sauf sur la série à corriger.
- Le type de charge d'une ancienne fiche devait être choisi pour chaque série. Un choix vaut désormais pour les séries du même exercice encore sans type.
- Les contacts prescrits pour tout l'exercice étaient proposés sur chaque série, soit 150 au lieu de 30 pour cinq séries. Ils sont répartis, ou laissés vides si la division n'est pas exacte.
- « Nouvelle séance » partait du lundi déjà passé de la semaine en cours. Elle part maintenant d'aujourd'hui.
- Le jeu de démonstration échouait dès qu'une séance était passée.

## Non couvert

- Génération, clarifications et revue du planificateur : aucune clé de prestataire utilisée.
- Dictée au micro, VoiceOver, hors ligne en conditions réelles.
- Téléphones physiques et Android.
