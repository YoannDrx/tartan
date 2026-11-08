# API commune du planificateur et limites de rythme

8 novembre 2026, depuis `a5a671f`, PR #45 en brouillon.

## Livraison

Le SDK commun au web et au natif expose la création d'une proposition relue, sa récupération, les clarifications, la préparation à relire, la confirmation de brouillons et les quotas du mois local. Les six routes authentifiées réutilisent les services de proposition et les contrôles d'accès ; les réponses sont validées par des contrats Zod partagés. Les réponses réussies portent `Cache-Control: private, no-store`. Les identifiants et confirmations sont validés, aucune route ne donne au fournisseur la possibilité de publier.

La création et la clarification disposent d'une durée maximale de 120 secondes, pour l'appel fournisseur limité à 90 secondes et la validation. Une réponse perdue reste récupérable par identifiant. Les quotas distinguent consommé, réservé et limite ; les baux expirés n'apparaissent plus comme actifs, même avant la restitution par le cron.

Sous le verrou de réservation, au maximum trois traitements fournisseur sont simultanés par espace, et douze nouvelles opérations sont autorisées par minute et par auteur. Les tentatives échouées restent dans ce compteur de rythme, même si leur quota mensuel est restitué. Le rejeu d'une opération connue reste possible sans nouvel appel ni nouveau décompte. Aucun changement du limiteur général des invitations.

## Validation

- **31 tests ciblés réussis** : 16 quotas/rythme, 13 workflow et deux intégrations SDK → routes → services → Postgres, avec modèle simulé.
- Le parcours d'intégration couvre question, réponse, relecture, confirmation, rejeu, récupération et lecture de quota. Un athlète, un autre espace, un appel sans session, un flag coupé ou une demande non relue n'appellent jamais le fournisseur.
- **626 tests serveur réussis**, 64 fichiers, 54,67 s.
- Types des packages et de l'application native réussis. La première vérification web a révélé deux incompatibilités dans le transport de test (en-têtes optionnels et signal nullable) ; corrigées, puis `tsc --noEmit` web réussi.
- Lint ciblé réussi ; aucun écran modifié, aucun nouveau test visuel revendiqué. Aucune migration supplémentaire dans ce lot.

## Reste ouvert

Les API sont disponibles dans le code mais l'IA demeure désactivée par défaut et en Preview. Interfaces web/natives, dictée, transcription et mesure de durée côté serveur, alias contrôlés, corpus d'évaluation et recettes utilisateurs restent à terminer. Les tests de ce lot simulent le fournisseur ; l'appel réel de référence est documenté dans `lot-e-propositions-ia.md`.
