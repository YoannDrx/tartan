# Publication groupée des séances

8 novembre 2026, travail depuis `4fd0c7d`, PR #45 en brouillon. Bases locales synthétiques uniquement ; aucune migration ni activation de production.

## Comportement et garanties

Web et applications natives proposent une sélection explicite de 1 à 14 brouillons dans la période du calendrier. Aucune sélection automatique. Les dates, destinataires et éventuelle programmation sont relus ; confirmer publie immédiatement, y compris une séance précédemment programmée.

L’API partagée recontrôle l’espace, le rôle, les groupes, athlètes et adaptations. Elle verrouille l’espace puis les séances dans un ordre stable, vérifie chaque version et revalide le choix de phase. Les copies de prescription et l’outbox sont écrites dans la même transaction. Une erreur annule toutes les nouvelles publications du lot. Les séances déjà publiées ne sont pas annulées.

Concurrence et réponse perdue : le passage à la version publiée reconnaît le rejeu immédiat ; il ne réémet pas de notification. Un rejeu après une modification ultérieure renvoie un conflit exigeant une relecture. Ce mécanisme n’est pas un archivage permanent de réponse par identifiant de requête. Deux séances le même jour comptent bien comme deux séances dans la notification groupée. Une panne de livraison conserve la file durable et ne transforme pas une publication confirmée en échec.

Les clients anciens, sans version de calendrier connue, ne proposent pas le contrôle groupé. Après un conflit, l’interface conserve la sélection pour une reprise ou permet de relire les données ; le bouton d’ouverture attend la fin du rafraîchissement. Le mobile utilise les mêmes contrats et règles.

## Vérification

- Suite serveur complète : **586 tests réussis**, 56,03 s. Six nouveaux scénarios : concurrence/rejeu, versions/annulation atomique, panne outbox/livraison, accès/révocation, ambiguïté de phase, bornes et doublons.
- Domaine partagé : **un test réussi** de sélection et compatibilité des versions.
- Navigateur, build de production : **deux parcours réussis en 22,3 s**, desktop et mobile ; publication, rejeu API, modification concurrente, conservation des brouillons et relecture corrigée. Axe, 390/768/1440 px et zoom 200 %.
- Types monorepo réussis. Lint sans erreur, quatre avertissements préexistants ; contrôle de design sans travers. Exports Hermes iOS et Android réussis après correction du rafraîchissement.
- Relecture React et des captures ; surfaces et contrôles du design system existant. Les skills UI/UX Pro Max et Frontend Design ne sont pas disponibles localement : leur exécution n’est pas revendiquée.

La première recette navigateur a rejeté un fixture qui supprimait les identifiants d’items ; le fixture conserve maintenant les références de la lecture d’édition. La seconde a découvert la réouverture prématurée après rafraîchissement : corrigée sur web et natif, puis retestée.

## Limites

Pas de test sur téléphone physique ni de réception de push/e-mail réel dans ce lot. L’export Hermes ne remplace pas une compilation signée ou une recette native. Le simulateur iPhone 17 Pro a été relancé avec l’API locale disponible, mais le contrôle visuel reste bloqué par le verrouillage macOS. La recette avec 30/60/120 athlètes reste ouverte. L’IA et les autres jalons du tableau de livraison restent à réaliser.
