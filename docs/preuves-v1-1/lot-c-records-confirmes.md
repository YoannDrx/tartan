# Records de séries — calcul serveur et confirmation

Développement du 8 novembre 2026 depuis `476ab4f`, PR #45 en brouillon. Cette preuve porte sur le commit contenant ce fichier. Aucun changement de schéma, de prestataire ou de drapeau en production.

## Comportement

L’historique web et natif présente les meilleures charges à répétitions égales, les meilleures répétitions à charge égale et les meilleurs 1RM estimés depuis les séries. Les calculs portent sur toutes les périodes, indépendamment du filtre de la courbe et de la limite de 200 séances affichées. Ils ne prennent que les séries de travail confirmées, liées explicitement à l’exercice et à une convention connue. Les anciens détails impossibles à interpréter ne deviennent pas des performances supposées.

Charge totale, lest additionnel, comptage total/par côté et nombre de côtés restent distincts. Epley exige 2 à 10 répétitions en charge totale ; une répétition reste une charge observée. Les tests du coach et sa référence de travail ne sont pas modifiés. La première séance comparable établit une référence initiale, avec sa meilleure série ; une égalité ne bat aucun record. L’ordre de référence est stable : date de séance, heure connue (les heures absentes viennent ensuite), date de création de la validation puis identifiant de validation. Cette convention de départage ne prétend pas retrouver l’heure réelle d’une performance non renseignée.

Le service lit par pages de 500 séries sous une transaction cohérente ; il conserve les meilleures valeurs par comparaison, sans charger tous les snapshots ni tronquer l’historique. Aucun retour santé, commentaire ni note privée n’est sélectionné. Les lectures gardent les contrôles d’espace, de rôle, d’athlète et de drapeau existants.

Lors d’une écriture, l’état précédent et le nouvel état sont comparés dans la transaction de validation, sous le verrou d’espace déjà utilisé par les mutations. La réponse ne confirme que les améliorations produites par cette mutation, avec identifiant et version. Une première référence, une égalité, une correction à la baisse et un rejeu ne produisent aucun événement de record. Les corrections et suppressions retirent les maxima devenus faux lors de la lecture suivante.

Le web et le natif affichent un encart statique « Records confirmés » après une réponse directe exploitable. Aucun badge n’est présenté avant l’accusé serveur. Le transport natif conserve cet accusé uniquement en mémoire pendant l’appel, ne l’écrit pas dans la file et ne le réémet pas lors d’une synchronisation ultérieure. Une réponse perdue peut donc ne pas produire d’encart ; le record courant reste consultable dans l’historique. Ce choix évite de célébrer à nouveau un ancien envoi. Les réponses d’un autre compte ou d’une version incohérente ne sont pas utilisées pour cet encart.

Les caches natifs d’historique sont invalidés après synchronisation, modification et suppression de séance. Les records ne sont pas un encouragement automatique à augmenter le tonnage.

## Preuves

- 123 tests domaine : conventions, première référence, Epley, indépendance de l’ordre des pages, doublons, correction/suppression, comparaison avant/après et refus de badge depuis une réponse rejouée/invalide/obsolète.
- Suite serveur complète : 532 tests réussis, puis quatre tests ciblés réussis après ajout du cas de pagination et passage par le service réel de suppression de séance. Comparaison à une séance de 2021 hors de la période de juin 2030, concurrence et rejeu, accès étranger refusé, drapeau, correction et suppression. Un maximum situé au-delà des 500 premières séries est bien retrouvé.
- 201 tests mobiles, dont accusé direct non persisté, absence de restitution lors de la synchronisation différée et invalidation de l’historique. Les tests existants de changement de compte continuent à passer.
- Deux parcours navigateur sur build de production : référence de travail 80 kg, séries à 40 kg puis correction via le formulaire coach à 50 kg ; deux records confirmés (charge et Epley), rejeu sans événement, historique à 50 kg/56,67 kg, correction à 30 kg qui rétablit le précédent maximum de 40 kg. Référence du coach toujours à 80 kg. Axe, trois largeurs, zoom 200 % et absence de débordement.
- Types du monorepo, lint sans nouvelle erreur, design check et exports Hermes iOS/Android. Captures des encarts et de l’historique relues. Impeccable statique reste limité à ses règles applicables au TSX ; Axe complète le contrôle dans le navigateur.

UI/UX Pro Max : provenance, unité, convention et date visibles ; texte accessible sans animation. Frontend Design : surface de travail sobre, valeur et libellé proches, sélection du type de record et dix lignes à la fois. Revue React : état de sélection local, données serveur dérivées, pas de calcul métier dans les composants et pas de conservation des événements après fermeture.

## Reste du lot C

La célébration unique de validation n’est pas encore enrichie des records. Les performances athlé typées (chronos à minimiser, distances à maximiser), la recette des écrans sur appareil physique et VoiceOver/TalkBack restent ouvertes. Aucune notification de record ni nouvelle animation n’est introduite par ce lot. La recette visuelle native attend toujours l’accès au Mac déverrouillé.

[Historique mobile](images/records-mobile.png) · [Confirmation desktop](images/record-confirmation-desktop.png) · [Confirmation web mobile](images/record-confirmation-mobile.png).
