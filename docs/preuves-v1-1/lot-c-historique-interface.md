# Historique par exercice — interfaces web et natives

Développement du 8 novembre 2026 depuis `7764dfd`, dans la PR #45 en brouillon. Aucune migration ni activation en production.

## Comportement livré

Depuis Progrès ou la fiche athlète, les mêmes services exposent l’exercice, la référence actuelle avec son origine et sa date, les tests, les prescriptions conservées et les séries réellement saisies. Les exercices archivés restent lisibles sous leur nom actuel, tandis que les anciennes séances gardent le nom et la prescription figés. Une référence manuelle sans test ni série figure désormais dans la sélection.

Filtres quatre semaines, douze semaines et un an ; le contexte serveur fournit la date de Paris, commune au web et au natif. Le web conserve exercice/période dans l’adresse ; le natif conserve la sélection dans l’écran. Courbes journalières distinctes du tonnage, de la distance, de la durée et des contacts, sans conversion entre unités. Abscisse temporelle proportionnelle, zéro visible, aucune liaison au-dessus d’une journée sans mesure et tableau textuel équivalent. Une courbe exige quatre journées renseignées ; aucune mesure ne devient un zéro supposé. Les doublons de saisie ne sont pas additionnés deux fois.

Les détails de séance sont repliables, dix séances initiales puis chargement d’affichage par dix. Le calculateur reprend la référence et le pas de l’exercice compatible, sans écriture de maximum. Les variantes au poids du corps, avec assistance ou avec seul lest additionnel ne reçoivent pas un calculateur Epley de charge totale.

## Portée explicite

La couverture actuelle compte les validations contenant des séries liées explicitement à cet exercice, pas toutes les séances prescrites. Une validation simple sans détail ne renseigne donc aucun volume. L’interface explique cette portée, les anciennes séries inexploitables et la limite de 200 validations par période. La couverture complète prévu/réalisé relève encore des analyses du lot D.

Les courbes de références de force, les records confirmés par le serveur, leur célébration et le rappel de la dernière réalisation dans la séance restent à terminer. Les meilleures séries d’une période ne sont pas présentées comme des records de carrière. Aucune donnée de santé, note privée ni commentaire de séance n’est exposé par ces routes.

## Vérifications

- 113 tests domaine, dont agrégation sans double décompte, mesures absentes, coupure de courbe, échelle temporelle et période traversant le changement d’heure.
- Sept tests serveur de l’historique : permissions espace/groupe/athlète, révocation, drapeau, référence manuelle seule, contexte minimal, correction, archive et troncature. Base locale dédiée.
- 199 tests mobiles ; types de tout le monorepo ; lint sans erreur (quatre avertissements préexistants) ; design check sans travers.
- Parcours navigateur sur build de production desktop/mobile : création d’une référence seule, cinq validations, 3 × 4 × 100 kg prescrits mais seulement 2 × 4 × 40 kg confirmés = 320 kg ; journée manquante, renommage/archivage, référence inchangée par le calculateur, filtre conservé et désactivation du drapeau. Axe, 390/768/1440 px et zoom 200 %.
- Le premier passage E2E a révélé un sélecteur trop large, qui lisait aussi les paragraphes dans les séances repliées. Il cible désormais la séance ouverte. Le premier export Expo demandait aussi la plateforme web, non utilisée par ce projet natif ; il a été relancé explicitement pour iOS et Android.

UI/UX Pro Max : période/exercice persistants, tableau équivalent, mesures absentes explicites. Frontend Design : bureau clair, données avant explications, aucune animation dans l’historique. Revue des captures : texte méthodologique déplacé derrière une ouverture explicite pour présenter la courbe plus tôt. Impeccable statique : aucun signal, avec limites déclarées du contrôle par expressions régulières ; les contrôles Axe réels le complètent. Revue React : valeurs dérivées sans effet, clefs de requêtes incluant espace/athlète/période, erreur d’autorisation prioritaire sur les données en cache, revalidation manuelle native.

Exports Hermes iOS et Android finaux réussis. La recette de cet écran dans le simulateur reste **non effectuée** : l’iPhone 17 Pro était ouvert sur le calculateur au début du lot, puis le Mac s’est verrouillé avant le parcours de l’historique. Demande de déverrouillage en attente. Aucun téléphone physique, VoiceOver ni TalkBack validé pour ce lot.

[Capture desktop](images/history-desktop.png) · [Capture web mobile](images/history-mobile.png). Captures du build de production local après la passe d’allègement visuel. L’étiquette des séries avec lest additionnel est distincte de la charge externe totale.
