# Rappel des séries précédentes — 8 novembre 2026

Lot développé depuis `de49e48`, PR #45. Le correctif distinct `4782ebc` rend exact le sélecteur du premier groupe dans le test de confirmation d’âge ; il corrige l’unique cause des deux échecs navigateur de la CI qualité `42428907138` du commit `7764dfd` (76 parcours réussis, 10 ignorés). Ce constat ne remplace pas une nouvelle CI verte.

## Rappel livré

Les formulaires de séries athlète et coach, web et natif, présentent les dernières séries de travail confirmées pour le même exercice et les mêmes conventions. Répétitions totales/par côté, un/deux côtés, charge externe/assistance/poids du corps et convention figée de l’exercice sont séparés. Le rappel suit les choix du formulaire sans remplacer aucune valeur ni cocher une réalisation.

Le serveur retrouve la dernière séance pertinente par comparaison, sans fenêtre arbitraire d’un an ni limite de 200 séances qui masquerait une ancienne série comparable. Séances futures, séance courante, échauffements, propositions non confirmées et anciennes cases sans conventions sont exclus. Pour la même date, les deux horaires doivent être connus et l’horaire de la source doit précéder celui de la cible. Le classement utilise la date programmée, puis l’horaire ; les ex æquo suivent la création de la validation, pas sa dernière correction.

La requête paramétrée reste limitée à l’athlète et à l’espace autorisés. Elle retrouve l’identité de l’exercice et sa convention dans la prescription figée, sélectionne seulement les champs de série nécessaires et ne lit ni retour santé, ni commentaire, ni note privée. Les fonctions publiques de lecture appliquent les permissions existantes avant cet adaptateur interne. Drapeau désactivé : aucun rappel ni identifiant d’historique ajouté à la réponse.

Douze séries au maximum sont renvoyées par comparaison, avec leur nombre total explicite. L’interface montre trois séries puis permet de déplier le reste du rappel. Si la réalisation comprend davantage de séries, elle le signale et propose l’historique complet. Le lien ouvre le bon athlète, le bon exercice et la période de cette réalisation ; un bouton permet de revenir à la période actuelle. Correction et suppression recalculent le rappel à la lecture.

Les écrans natifs de saisie masquent désormais le contenu en cache après une réponse 401/403/404, tout en conservant les données hors ligne lors d’une erreur réseau ou serveur. L’état de désactivation du suivi dans l’espace courant est également respecté.

## Preuves

- **528 tests serveur** sur la suite complète après intégration dans la lecture des séances ; puis **cinq tests ciblés** après ajout de la limite explicite à douze séries. Cas : 40 kg précédents/100 kg prescrits, correction, suppression vers une réalisation de 2021, horaires connus/inconnus, conventions distinctes, héritage incomplet, santé absente du rappel, autres athlètes/coachs/espaces, accès révoqué et drapeau.
- **114 tests domaine** : sélection selon les conventions choisies, déduplication et absence de mutation du brouillon. **200 tests mobiles**, dont distinction refus d’accès/panne réseau pour le cache.
- Types monorepo, lint sans erreur (quatre avertissements existants), design check sans travers ; exports Hermes iOS et Android.
- Huit parcours de production réussis : confirmation/correction d’âge, saisie coach de deux athlètes, conflit concurrent et historique, sur desktop/mobile. Parcours d’historique ensuite enrichi : rappel à 40 kg, formulaire conservé à 100 kg, convention par côté sans rappel trompeur, lien vers la période historique puis retour à aujourd’hui. Axe et absence de débordement.

Passes UI/UX Pro Max et Frontend Design : rappel distinct de la prescription, conventions lisibles, trois séries initiales, dévoilement du détail et navigation contextualisée. Impeccable statique sans signal ; sa portée regex est complétée par la recette navigateur et Axe. Revue React : sélection dérivée du brouillon, aucune copie automatique dans les champs, mêmes règles partagées web/natif.

La nouvelle recette simulée reste en attente du déverrouillage du Mac. Aucun test physique ni validation VoiceOver/TalkBack revendiqué. Pas de migration, de déploiement en production ou d’activation. Les courbes de force, la confirmation des records et leur célébration restent à implémenter.

[Capture desktop](images/reminder-desktop.png) · [Capture web mobile](images/reminder-mobile.png). Après le bornage, les deux parcours enrichis ont été rejoués avec succès sur build de production, ainsi que les types monorepo et les exports Hermes finaux.
