# Performances athlé comparables

Développement du 8 novembre 2026 depuis `9ea0639`, PR #45 en brouillon. Preuve attachée au commit contenant ce fichier. Les essais utilisent des comptes fictifs et des bases locales jetables ; aucune écriture ni activation en production.

## Livré

Le résultat conserve son type de mesure et sa règle : chrono en secondes à minimiser, distance en mètres ou centimètres à maximiser. Les conversions cm/m utilisent des entiers à la précision stockée, sans amélioration artificielle liée aux nombres flottants. La comparaison sépare exactement l'épreuve, le type, la règle et le libellé des conditions. Les conditions sont sportives et facultatives ; un libellé différent forme une autre série. Le vent peut être renseigné. Il ne s'agit pas d'une homologation officielle ni d'un filtre réglementaire automatique sur le vent.

La première mesure comparable établit une référence initiale. Une égalité ne bat pas cette référence. La meilleure mesure ultérieure constitue un record amélioré. L'ordre suit date de performance, création et identifiant ; il ne prétend pas retrouver une heure de réalisation absente. Une correction, une suppression ou une saisie antidatée recalcule les états depuis tous les résultats restants.

Le coach peut ajouter, corriger et supprimer depuis la fiche web et depuis un écran natif dédié. Une version attendue protège correction et suppression ; une ancienne application ne peut pas supprimer une saisie déjà corrigée. L'écriture et le recalcul sont dans la même transaction, sous verrou d'espace. Les lectures athlètes sélectionnent seulement les champs nécessaires, sans notes privées ni métadonnées de déduplication.

Les créations modernes portent un identifiant persistant. Un rejeu ne crée pas un second résultat, ne remplace pas une correction et ne ressuscite pas un résultat supprimé. Une trace technique de création reste après la suppression du résultat et disparaît avec l'athlète ou l'espace. Une réponse de correction perdue impose une relecture via le conflit de version ; les performances ne sont pas ajoutées à la file hors ligne des séries.

Les listes distinguent référence initiale et record. La règle et les conditions restent visibles. La correction utilise une action compacte nommée pour les lecteurs d'écran. Le formulaire natif garde ses champs en cas d'erreur, annonce les erreurs et protège le retour avec des changements non enregistrés. Il est isolé par compte/espace/athlète. Ces résultats ne déclenchent pas une nouvelle animation.

## Migration et preuves

- Migration additive `20261108030000_performance_rules` : type, règle, conditions, version et table de déduplication. Les seules anciennes unités rapprochées sont `s`, `m`, `cm`. Les inconnues restent sans règle et ne produisent pas de record. Les écritures anciennes sans nouveaux champs restent acceptées.
- Schéma complet appliqué sur bases vierges locales ; test SQL synthétique des quatre anciennes unités, écriture d'ancien client et refus de règles incohérentes. Comparaison Prisma du schéma migré : aucun écart sur les tables de ce lot ; seuls des écarts préexistants d'autres tables sont signalés, non appliqués.
- 540 tests serveur complets réussis, puis cinq tests ciblés après ajout du test de migration et du cas d'effacement de la trace avec l'athlète. Concurrence, droits, conflits, déduplication, correction et suppression couverts.
- 128 tests métier et 201 tests mobiles réussis. Types du monorepo, lint sans nouvelle erreur, design check et exports Hermes iOS/Android vérifiés ; les dernières commandes de validation figurent dans le suivi de livraison.
- Deux parcours navigateur de production réussis : ajout via formulaire, première référence, chrono amélioré, correction vers une valeur moins bonne, conflit, suppression et création HTTP dédupliquée. Axe, 390/768/1440 px, formulaire à 200 % et absence de débordement ; captures relues.

UI/UX Pro Max : la proposition de page marketing était hors contexte ; recherche ciblée sur les erreurs de formulaire retenue, avec annonce et résumé accessible. Frontend Design : maintien de la DA de travail du dépôt, données avant actions, correction compacte. Impeccable statique complété par Axe et les captures ; il ne vérifie pas l'ergonomie native.

La recette de l'écran natif sur simulateur et appareils physiques reste ouverte, le Mac étant verrouillé. Les exports ne remplacent pas cette recette. La migration a aussi été appliquée à la Preview isolée `br-floral-sun-b9iar8ge` : 29 → 30 migrations en 2,66 s, zéro compte et aucun drapeau activé. Lecture de la nouvelle table via le rôle applicatif limité vérifiée. Aucune migration de ce lot en production.

Vérification HTTP finale : quatre parcours réussis, dont création/correction/suppression avec le client API natif partagé et les routes de désinscription push/déblocage. [Liste mobile](images/performances-mobile.png) · [Formulaire mobile](images/performance-form-mobile.png).
