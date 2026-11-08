# Socle du planificateur IA — contrat et adaptateur

8 novembre 2026, depuis `852ea1b`, PR #45 en brouillon. Aucun appel réel de génération/transcription, aucune migration, aucun déploiement ni activation.

## Implémenté

- Contrat strict exporté depuis `packages/contracts` : clés obligatoires, absences explicites, quatorze séances maximum, sept jours maximum. Questions et séances proposées sont mutuellement exclusives dans la validation métier. Les hypothèses et suggestions sont séparées.
- Validation pure : jetons d’exercice et de destinataire autorisés, dates, citations présentes dans les instructions relues et prescriptions conformes au contrat existant. Une charge absolue est conservée ; un pourcentage référence l’exercice résolu par le serveur. Aucun calcul de maximum ni conversion RPE/RIR en kilos.
- Bornes pures des quotas Coach/pilote 30 propositions et 60 minutes, Club 150 et 300 minutes ; Découverte refusée. Audio 3 Mio et 180 secondes. Échéances sept jours ou au plus vingt-quatre heures après création des brouillons. Ces règles ne réservent ni ne purgent de données par elles-mêmes.
- Adaptateur serveur Responses API avec modèle configurable, sortie JSON stricte, `store:false`, aucun outil ni historique distant, délai de 90 secondes. Refus, réponse incomplète, JSON invalide et incohérence métier sont rejetés. Pas de rejeu facturable automatique.
- Projection du contexte refusant tout champ supplémentaire, sans identité de compte, maximum individuel, santé structurée ou note privée. Le texte libre reste une donnée utilisateur : cette projection ne garantit pas que le coach n’y dicte jamais de données personnelles.
- `AI_PLANNER_ENABLED=false` par défaut ; alias local de clé supporté. Modèles configurables initiaux : `gpt-4.1-mini` pour interprétation et `gpt-4o-mini-transcribe` pour future transcription. Ce dernier n’est pas encore appelé. Le document de plan précédent ne fixait pas les modèles.

## Vérification

14 tests domaine réussis, 9 tests d’adaptateur avec transport simulé réussis, types du monorepo réussis. Le schéma généré est vérifié sans propriété facultative ni objet ouvert. Tests des quotas aux bornes, durée/taille invalides, conservation au changement d’heure, cibles et exercices étrangers, incohérences, erreurs HTTP/réseau et arrêt sans appel. Aucun de ces tests n’est une évaluation de précision du modèle.

Documentation officielle consultée : [sorties structurées](https://developers.openai.com/api/docs/guides/structured-outputs). `store:false` ne signifie pas rétention nulle chez le fournisseur ; les conditions effectives et transferts restent à vérifier.

## Restant avant toute exposition

Services d’accès et drapeau de l’espace, état persistant et réservation atomique, reprise/restitution des quotas, projection des cibles et exercices avec rapprochement local, transcription et contrôle de durée serveur, revue des textes, clarifications, adaptations, création atomique de brouillons puis publication séparée, purge effective, web et natif, corpus soixante cas dont trente dictées, essais fournisseur réels.

La validation des citations ne prouve pas la fidélité de tous les nombres interprétés : l’évaluation et la relecture coach restent nécessaires. L’adaptateur n’est accessible par aucune route publique et n’autorise aucune écriture. La clé anciennement exposée n’a pas été prouvée révoquée.
