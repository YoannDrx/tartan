# Phases de préparation — gestion et partage

8 novembre 2026, développement depuis `fcda7e5`, PR #45 en brouillon. Preuve attachée au commit contenant ce fichier. Comptes fictifs, bases locales jetables et Preview isolée ; aucune migration ni activation de ce lot en production.

## Périmètre implémenté

Une phase cible un groupe ou un athlète : nom, type, dates inclusives, objectif, description partageable et note privée. Création privée, partage et retrait explicites. Les durées sont libres. Les périodes d'une même cible ne peuvent pas se chevaucher, même entre deux créations simultanées. Les phases d'un groupe et celles d'un athlète peuvent se superposer.

Le verrou d'espace sérialise les mutations ; droits et cibles sont revérifiés après acquisition. Une réattribution vérifie l'ancienne et la nouvelle cible. La version attendue refuse l'écrasement silencieux. Un identifiant de création stable et une empreinte dédupliquent le rejeu après perte de réponse ; le rejeu ne réécrit pas une correction. La suppression efface les contenus personnels et garde une trace sans ces contenus pour ne pas ressusciter l'objet. Cette trace disparaît avec la cible ou l'espace.

Les projections athlète et assistant excluent la note privée de la requête SQL et ne lisent que les phases partagées. Une phase individuelle privée ne modifie donc pas indirectement la liste publique. Les règles pures donnent priorité à l'individuel et retournent un choix requis en présence de plusieurs phases de groupes. Le constructeur web et natif applique désormais cette priorité et demande un choix explicite entre groupes. Le futur planificateur reste à raccorder.

Gestion web et native : création, correction, partage/retrait, suppression, erreurs conservant les valeurs et confirmation d'abandon. Calendrier et Progrès affichent les phases derrière le drapeau d'espace. Frise statique avec dates équivalentes lisibles, indication de semaine dans la période consultée, contenu partageable et note repliable sur le web. Le natif utilise l'API commune ; ses lectures restent en mémoire, sont séparées par compte/espace/rôle et ne réaffichent pas les données en cas de refus serveur. Les phases n'entrent pas dans le cache persistant.

Une modification ou suppression ne change pas les séances ni leurs attributions. Une programmation individuelle récente protège la fiche sans compte de la purge ; un objet retiré ne prolonge pas cette protection. L'export utilisateur inclut les phases partagées individuelles et de ses groupes, sans notes ni phases privées. Il inclut également la règle et les conditions des performances athlé.

## Vérifications

- 549 tests serveur réussis sur la suite complète, dont accès inter-espaces, groupes révoqués, concurrence, bornes inclusives, versions, suppression/rejeu, export, conservation et absence de modification d'une séance existante.
- 131 tests domaine et 201 tests mobiles réussis. Le total mobile couvre les règles existantes ; il ne constitue pas une recette de l'écran natif de phases.
- Types monorepo réussis ; lint sans erreur et quatre avertissements préexistants. Impeccable statique : zéro travers détecté.
- Deux parcours sur build de production, desktop et web mobile, réussis en 29,5 s : création privée, partage, chevauchement, modification concurrente, préservation de la saisie, frise calendrier et requêtes du client partagé natif. Axe et absence de débordement à 390/768/1440 px ; formulaire à 200 %.
- Captures relues : la première passe révélait la route hors du thème de travail. Route corrigée, puis recette répétée avec assertions sur le fond clair de la page et du dialogue. [Desktop](images/phases-desktop.png), [mobile](images/phases-mobile.png), [formulaire mobile](images/phase-form-mobile.png).
- Export Hermes iOS et Android réussi. La recette interactive native reste ouverte : le simulateur iPhone 17 Pro et le processus de l'app sont démarrés, mais l'outil d'interface indique toujours le Mac verrouillé. Aucun essai physique, VoiceOver ou TalkBack revendiqué.
- Migration additive `20261108040000_training_phases`, appliquée sur les bases locales réinitialisées et la Preview `br-floral-sun-b9iar8ge` : 30 → 31 migrations en 3,04 s, zéro compte et aucun drapeau activé. Lecture de la table avec le rôle `tartan_preview_app` vérifiée. Production inchangée.

UI/UX Pro Max n'a pas donné de correspondance vérifiée pour une frise de phases : résultat marketing, puis courbe temporelle hors contexte. La frise et ses équivalents textuels suivent donc les règles générales d'accessibilité et `DESIGN.md`, sans reprendre ces recommandations hors sujet. Frontend Design : surfaces claires, Barlow, information avant actions, rouge réservé aux actions et aux phases partagées ; aucune animation ajoutée. Impeccable est complété par les captures et Axe.

## Suite du lot D

Les analyses prévu/réalisé, diversité et couverture par groupe/athlète/phase restent ouvertes. Le contexte du constructeur et les filtres natifs par cible sont ajoutés dans la preuve complémentaire ci-dessous. La recette avec 30/60/120 athlètes sur ces nouveaux écrans, les essais coachs et les appareils physiques restent à faire. L'IA et les conditions externes de commercialisation ne sont pas validées par ce lot.

## Complément — contexte du constructeur

8 novembre 2026, depuis `cc57f89`, même environnement local. Le choix des destinataires précède les blocs de séance. Le contexte affiche les phases du groupe et les priorités individuelles à la date sélectionnée. Plusieurs groupes actifs demandent un choix explicite avant publication ; enregistrer un brouillon reste possible. Une réponse ancienne, un refus ou une requête en cours ne débloque pas la publication. Les nouvelles appartenances à un groupe ne sont pas projetées sur les dates précédant leur création.

Le service recontrôle l'espace et les destinataires. Un coach adjoint peut préparer ses séances avec les phases partagées uniquement ; aucune note privée n'est sélectionnée. Le mobile permet aussi de rechercher et filtrer les phases par groupe ou athlète.

Limite explicite : ce contexte guide l'édition en cours ; le choix multi-groupes n'est pas encore conservé avec la séance ni revalidé dans sa transaction de publication. Il ne constitue pas une attribution historique à une phase. Ce point reste à traiter avant de présenter des statistiques attribuées à la phase choisie.

- 21 tests serveur ciblés réussis : phases et identité des séances, incluant contexte multi-groupes, priorité individuelle, refus hors périmètre, choix périmé, groupe vide, dates d'appartenance et accès adjoint.
- Quatre parcours navigateur sur build de production réussis en 42,1 s : contexte des phases et identité des séances, desktop et mobile. Blocage avant choix, publication après choix, priorité individuelle, absence de note privée, Axe et débordement contrôlés.
- Types du monorepo verts, lint sans erreur (quatre avertissements préexistants), Impeccable sans travers. Export Hermes iOS et Android réussi avant l'ajout du filtre natif par cible ; types natifs revérifiés après cet ajout.
- [Contexte desktop](images/phase-planning-desktop.png) et [mobile](images/phase-planning-mobile.png) relus. Pas de recette native interactive ou physique supplémentaire : contrôle du simulateur toujours bloqué par le verrouillage du Mac.
- CI qualité `fcda7e5` réussie, run `42436975131`. Cette CI précède les phases ; nouvelle CI requise pour le présent commit.
