# Lot A — contexte du calendrier et du suivi

8 novembre 2026, branche `codex/v1-1-progression`, après `94e90a6`. Vérification locale isolée ; aucune modification de production.

## Problème corrigé

Depuis une période future ou un groupe filtré, « Nouvelle séance » ouvrait le constructeur sans date ni groupe. Les liens du calendrier et du suivi perdaient aussi le contexte après consultation ou modification. Avec plusieurs groupes, le coach devait reconstruire son choix.

Le bouton principal conserve maintenant la période et le groupe. Le bouton d’un jour conserve sa date exacte. La vue mois propose son premier jour, visible et modifiable dans l’éditeur. Le passage semaine/mois utilise la période consultée, pas systématiquement la date du jour.

Un lien explicite ramène à la période sélectionnée. Le contexte suit l’enregistrement d’un premier brouillon, le rechargement, la publication, l’édition, l’actualisation des charges et l’ouverture des séries d’un athlète. Les ancres d’athlète restent conservées dans le suivi. La suppression depuis l’éditeur retourne aussi au contexte fourni.

## Garde-fous

Le contexte transmis dans `retour` est reconstruit depuis une liste fermée : `/calendrier` ou `/suivi`, période valide et UUID de groupe. Les URL externes, protocoles, autres routes, fragments et paramètres libres ne deviennent jamais une destination de retour. Une date impossible n’est pas normalisée silencieusement.

La présélection d’un groupe passe par le contexte autorisé du constructeur. Un groupe absent de cette liste affiche un message et laisse les destinataires vides, même si un autre groupe unique est disponible. Aucun groupe inaccessible n’est ajouté aux attributions. Les anciennes séances conservent leurs attributions existantes.

Les contrôles d’accès serveur et de version des écritures restent appliqués. Aucun nouveau contrat API, champ de base, secret ou appel prestataire. Les liens sans contexte gardent leur comportement antérieur.

## Preuves

- Trois tests unitaires : reconstruction autorisée du contexte, refus des destinations libres et dates invalides, conservation d’une ancre, préparation de la date et du groupe sans destinataire inventé.
- Types web réussis après la recette ; lint web sans erreur (quatre avertissements préexistants), `design:check` sans travers.
- Deux parcours navigateur desktop/web mobile réussis en **44,5 s** sur Next en développement : nouvelle séance depuis un groupe et une semaine futurs ; sauvegarde, rechargement et contrôle de l’attribution via l’API ; publication, édition et retour ; vue mois ; groupe indisponible et destination externe refusée. Axe et absence de défilement horizontal.

La première exécution du harnais rechargeait avant la fin d’une navigation React et annulait celle-ci. L’attente explicite de l’adresse cible corrige le harnais ; aucune assertion métier n’a été supprimée.

## Limites et suite

Cette modification concerne la navigation web. Elle ne constitue pas une recette native ou physique. Le panneau de détail desktop et l’écran mobile dédié prévus au plan restent à finaliser ; ce lot prépare leur contexte de retour. L’ouverture commerciale, les flags de progression/phases et la disponibilité de l’IA ne changent pas.
