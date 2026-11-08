# Analyse attribuée aux phases conservées

8 novembre 2026, depuis `865d8f0`, PR #45 en brouillon. Bases locales synthétiques `tartan_v11_test` et `tartan_v11_e2e`. Pas de migration supplémentaire, de changement externe ni d’activation en production.

## Comportement

Pour un propriétaire ou coach autorisé, le filtre utilise exclusivement l’identifiant de phase conservé dans la prescription individuelle. Il ne rattache pas une ancienne séance parce que ses dates correspondent à celles d’une phase créée ensuite. Le résumé distingue séances attribuées, séances sans référence conservée et séances d’une autre phase dans le périmètre sélectionné. Une absence de référence comprend les anciennes données et les prescriptions sans phase ; elle n’est jamais présentée comme une attribution certaine.

Lorsqu’un athlète a enregistré sa séance, l’analyse retrouve la copie correspondant exactement à la version réalisée. Une nouvelle prescription n’écrase donc pas son ancien contexte. Sans version connue, une validation historique ne reçoit pas arbitrairement la dernière phase. Le statut « manqué » créé automatiquement garde cependant le contexte du prévu : il ne représente pas une réalisation ni une réponse.

Une modification des dates de phase ne modifie pas les copies. Le contexte de consultation coach englobe les dates de séances avec une référence historique autorisée. Un choix explicite de fenêtre de un à 366 jours est disponible sur web et natif, notamment pour une phase longue ou déplacée de plus d’un an. Modifier ces filtres ne modifie pas les phases ou séances. La limite de 5 000 séances reste explicite, sans troncature silencieuse.

La comparaison précédente porte sur les mêmes athlètes que les séances attribuées de la période courante, même si leur programmation précédente relevait d’une autre phase. Le filtre de groupe facultatif reste celui des membres actuels. Sans ce filtre, le propriétaire conserve les références passées d’un athlète sorti du groupe ; une prescription ne lui réattribue pas les séances futures.

## Confidentialité et compatibilité

Un athlète ou adjoint consulte une **période partagée**, annoncée comme telle. Ses bornes et ses volumes ne dépendent jamais des priorités privées du coach. Les références privées ne sont pas sélectionnées dans cette vue, ni utilisées pour élargir ses dates. Une phase individuelle privée ne fait donc pas disparaître silencieusement des séances de la vue publique d’une phase de groupe.

Les requêtes supplémentaires de références exactes et de bornes historiques sont réservées au contexte coach autorisé, paramétrées, limitées par espace et athlètes visibles. Elles ne sélectionnent ni notes privées ni colonnes de santé. Les règles de consentement des agrégats existants restent applicables. Les phases hors périmètre et les autres espaces sont refusés.

Le contrat indique la base du filtre et sa couverture ; le comportement de repli d’une ancienne réponse est la période partagée. Web et mobile utilisent la même API et la même règle de cohorte dans `packages/domain`. Les explications et les dates avancées sont repliables ; les données manquantes restent visibles.

## Preuves

- **25 tests serveur ciblés réussis en 4,59 s** : analyse, attribution historique et conservation du choix de phase. Date corrigée, copie réalisée plus ancienne, validation sans version, priorité privée sans effet public, sortie du groupe, refus hors périmètre/espace, statut manqué automatique et absence d’attribution rétroactive couverts.
- **12 tests domaine réussis**, dont cohorte de comparaison précédente, séparation des unités, couverture et données manquantes.
- **Deux parcours navigateur sur build de production réussis en 27,4 s** après la dernière passe visuelle : 1 920 kg prévus / 960 kg réalisés, phase créée avant publication, déplacement de plus d’un an, fenêtre explicite retrouvant l’historique et conservée au changement de cible, contrôle du consentement, Axe, 390/768/1440 px et zoom 200 %.
- Types monorepo verts avant le dernier repli visuel ; build web de production et types natifs revérifiés après. Lint sans erreur avec quatre avertissements préexistants ; contrôle Impeccable sans travers. Export Hermes iOS/Android vérifié pour ce lot.
- [Desktop](images/analysis-phase-desktop.png), [web mobile](images/analysis-phase-mobile.png). Relecture : dates avancées et explications repliées pour rapprocher les données. La barre fixe dans la capture pleine page apparaît à la borne du viewport de capture ; les interactions et débordements sont vérifiés séparément.

La passe conserve le vocabulaire, les surfaces et les graphiques de l’écran d’analyse déjà revus avec les recommandations UI/UX Pro Max et Frontend Design ; la relecture React, Impeccable, Axe et les captures complètent ce changement. Aucun essai interactif natif, VoiceOver/TalkBack ni téléphone physique supplémentaire revendiqué.

Le lot D reste ouvert pour les répartitions par mouvement/matériel, les intensités homogènes et la recette globale. Le planificateur IA, les services externes, le juridique et les stores ne sont pas validés par cette preuve.
