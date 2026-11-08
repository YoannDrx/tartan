# Courbes de force — web et applications natives

Développement du 8 novembre 2026 depuis `4e84a10`, PR #45 en brouillon. Pas de migration, d’appel prestataire ni d’activation en production. La preuve porte sur le commit contenant ce fichier et les composants associés.

## Comportement

L’historique distingue les tests 1RM, les tests 3RM, les estimations enregistrées par le coach, les charges réellement réalisées à répétitions égales et les estimations Epley issues de séries de travail confirmées. Les conventions de charge, le comptage total/par côté et le nombre de côtés ne sont jamais fusionnés. Les tests n’enregistrant pas de convention de répétitions restent séparés des séries.

Epley utilise uniquement 2 à 10 répétitions en charge externe totale. Une série à une répétition reste une charge réalisée ; elle ne devient pas automatiquement un test maximal. Lest additionnel, assistance et poids du corps ne sont pas convertis en maximum de charge totale. Échauffements, séries non confirmées et données absentes sont exclus. La référence choisie par le coach n’est jamais remplacée par ces courbes.

La meilleure valeur d’une journée est retenue, sans additionner les charges. Les versions de saisie sont dédupliquées, et le calcul repart des données courantes après correction ou suppression. L’axe horizontal respecte les dates ; une journée présente mais sans mesure comparable coupe la ligne. Les jours sans aucune observation ne sont pas inventés. Les conventions et la provenance restent visibles au choix de courbe.

Une courbe exige quatre journées renseignées. Le résumé textuel et le tableau équivalent exposent les valeurs et le nombre de validations ou tests retenus parmi ceux du jour. Cette couverture ne représente pas toutes les séances prescrites : la limite de l’historique existant est conservée et expliquée. Les tests détaillés et les explications sont repliables pour présenter les données plus tôt. Aucune animation ni célébration n’est ajoutée dans l’historique.

## Vérifications locales

- 118 tests domaine passent, dont quatre nouveaux scénarios couvrant provenance, Epley, conventions, échauffement, données manquantes, période, doublons, correction et suppression.
- Deux parcours navigateur sur build de production : référence manuelle 80 kg, tests 1RM de 90 à 105 kg, test 3RM à 85 kg et estimation coach à 110 kg séparés ; prescription 100 kg, réalisation 4 répétitions à 40 kg, estimation Epley 45,33 kg. Journée manquante explicite et référence toujours égale à 80 kg.
- Contrôles Axe, 390/768/1440 px et zoom 200 %, tableaux équivalents et absence de débordement. Captures relues ; liste des tests ensuite repliée sur web et natif, avec revalidation du parcours.
- Types du monorepo, lint sans erreur (quatre avertissements existants), contrôle design sans travers et exports Hermes iOS/Android.
- Impeccable statique ne remonte aucun signal ; son analyse TSX par expressions régulières ne remplace pas la vérification de contraste et de structure faite sur le navigateur.

UI/UX Pro Max : séries temporelles, valeurs manquantes explicites et tableau accessible. Frontend Design : données avant méthode, détails dépliables, aucune couleur utilisée seule pour expliquer la provenance. Revue React : calcul mémorisé sur les données, sélection dérivée avec repli sûr si la courbe disparaît, aucune écriture serveur déclenchée par un changement d’affichage.

La recette visuelle native n’est pas validée : Simulator ne peut pas être contrôlé tant que le Mac est verrouillé. Les exports ne valent ni recette sur téléphone, ni test VoiceOver/TalkBack. Les records confirmés côté serveur et la célébration unique restent à implémenter.

[Desktop](images/force-desktop.png) · [Web mobile](images/force-mobile.png).
