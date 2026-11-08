# Historique par exercice — socle, 8 novembre 2026

Développé depuis `e9e907b`. Services et contrats partagés pour la liste des exercices réellement renseignés et l’historique détaillé d’un athlète. API native disponible. Pas encore d’écran d’historique livré dans ce commit.

Les séries sont rattachées par identifiant d’exercice et référence d’item figée. Nom, prescription et charge résolue viennent de la copie historique ; référence actuelle et tests liés sont retournés séparément. Un renommage, un archivage ou une nouvelle référence de travail ne modifie pas les séries passées. Échauffement, séries non réalisées, conventions et valeurs manquantes restent explicites. Les volumes proviennent seulement des séries de travail réalisées.

Accès contrôlé par espace, rôle, athlète/groupe et drapeau de progression. Aucun commentaire de validation, douleur, RPE ou note privée dans la réponse. La période est limitée à 366 jours, avec 200 séances maximum ; total, troncature et séries inutilisables sont annoncés. Les anciens tests sans relation ne sont pas rapprochés par leur nom. Ce périmètre n’est pas présenté comme un record sur toute la carrière.

Règles pures supplémentaires : rappel de la dernière réalisation comparable et calcul de records de charge à répétitions égales, répétitions à charge égale, Epley limité à 1–10 répétitions. Conventions et côtés distincts ; pas d’estimation Epley du seul lest, de l’assistance ou du poids du corps. Première séance d’une comparaison = référence initiale ; égalités et répétition d’une lecture ne créent pas d’amélioration. Une correction/suppression produit un nouveau calcul. Ces règles ne déclenchent encore aucune célébration ni événement persistant.

Preuves locales : **108 tests domaine**, **six nouveaux tests serveur**, types monorepo et lint sans erreur (quatre avertissements antérieurs). Le premier essai serveur a utilisé à tort le statut `removed` dans sa fixture de révocation ; corrigé vers le statut réel `suspended`, puis six scénarios réussis. Cas couverts : deux séries de 4 × 40 = 320 kg malgré une prescription à 100 kg ; anciennes cases sans convention ; renommage/archivage/nouvelle référence ; correction/rejeu/suppression ; autre espace/athlète/groupe/révocation/flag ; troncature de 202 séances à 200 et période vide. Aucune migration ni activation en production.

Restent au lot C : écrans web/natifs, graphiques et calculateur, intégration du rappel dans la séance, records sportifs explicites, confirmation serveur et célébration unique. Le calcul pur ne prouve pas ces parcours.
