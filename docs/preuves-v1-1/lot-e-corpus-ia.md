# Lot E — corpus réel du prestataire, 8 novembre 2026

## Reprise du 9 novembre 2026 : seuils atteints sur le corpus texte

**Seuils décidés : au moins 57/60, 0 date fausse, 0 charge inventée. Dernier passage : 59/60, 0, 0.** Modèle : `gpt-4.1-mini`, température 0. Les soixante consignes et leurs attendus sont inchangés (`planner-corpus.ts` non modifié). Détail par cas et empreintes : [rapport réduit](corpus-ia-2026-11-09.json), sans consigne ni réponse du modèle.

| Passage | Cas réussis | Dates fausses | Charges inventées | Rattachements | Clarifications | Note |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Base (code du 8 nov.) | 48 / 60 | non mesuré | non mesuré | 31 / 32 | 19 / 30 | L’indicateur n’existait pas encore. C16 (« hier ») et C18 (huit jours tronqués) sont pourtant des dates fausses |
| Garde-fous, 1re version | 58 / 60 | 0 | 0 | 29 / 32 | 30 / 30 | |
| Garde-fous, 2e version | 57 / 60 | 0 | 0 | 29 / 32 | 29 / 30 | |
| Candidat | 59 / 60 | 0 | 0 | 32 / 32 | 29 / 30 | |
| Même code, rejoué | 58 / 60 | 0 | **1 (C26)** | 32 / 32 | 28 / 30 | **Seuil manqué** : le modèle a choisi seul entre 40 kg et 60 kg. Le passage précédent ne valait donc pas preuve |
| **Final** | **59 / 60** | **0** | **0** | **32 / 32** | **29 / 30** | Contrôle déterministe ajouté après C26 |

Six passages complets, sans réessai sélectif. Le passage final n’a pas été répété : la limite d’environ six passages était atteinte. Échec restant : C22 (athlète hors périmètre) ; le modèle renvoie une proposition vide, le serveur la refuse comme sortie invalide : aucune séance créée, quota remboursé, mais le coach reçoit une erreur et non une question.

**Ce que ce chiffre ne dit pas.** Les contrôles ont été écrits en regardant les échecs de ce corpus : il n’est plus un jeu de validation indépendant. Le modèle reste variable d’un passage à l’autre, même à température 0. Seize cas fictifs supplémentaires, non versionnés, écrits avant d’en voir les réponses, donnent 13/16 sur le code final (14/16 sur les deux versions précédentes), sans date fausse ni charge inventée. Les trois échecs : deux questions de date inutiles (« comme hier », « le 8 juin » pourtant dans la période) et deux séances séparées au lieu d’une seule pour deux groupes. Le comportement attendu en production est donc plus de questions inutiles que dans le score ci-dessus.

### Correctifs

Contrôles déterministes côté serveur (`packages/domain/src/planner-guards.ts`, 29 tests) : ils ne complètent jamais une séance, une sortie douteuse devient une question sans séance.

- Dates : jour de semaine contradictoire, intervalle hors période, relatif (« hier », « demain ») non respecté, jour cité absent de la proposition, aucun jour indiqué sur une période de plusieurs jours.
- Charges : la valeur doit figurer dans la consigne avec son unité, chiffres et lettres compris ; deux charges pour une même prescription, habitude sans valeur (« charge habituelle ») sont une question. Un pourcentage nul devient une absence de charge.
- Exercice : retenu seulement s’il est nommé (nom, alias, mot distinctif porté par cette seule fiche). Un exercice sans attache dans la consigne est retiré, avec une hypothèse visible. Une citation altérée est restaurée depuis la consigne au lieu de rejeter la proposition.
- Destinataires et volume : un groupe nommé n’est jamais oublié, plus de quatorze séances est une question, trois questions au plus et une par information.

Prompt et contrat : sens de chaque valeur de `field`, dates déjà calculées transmises au modèle (`dateHints`), interdiction d’ajouter un échauffement, tractions au poids du corps sans charge, « charge à définir » sans question.

**Nouvelle reprise automatique, à valider par le fondateur.** Quand un jour cité manque, le serveur redemande une seule fois au modèle. Le coach ne paie qu’une proposition, mais Tartan paie un appel de plus, ce qui s’écarte de la règle « pas de rejeu facturable automatique » du [socle](lot-e-socle-ia.md). Elle sert au cas P30 ; la retirer ne ferait perdre que ce cas d’après les passages précédents.

Indicateurs `falseDate` et `inventedLoad` ajoutés à l’évaluateur, sans effet sur la réussite d’un cas : une séance produite alors que la date ou la charge devait être précisée, une date hors de celles attendues, une charge différente de l’attendu.

### Activation

`AI_PLANNER_ENABLED` devient un coupe-circuit : absent, le planificateur s’ouvre dès qu’une clé est configurée ; `false` le coupe ; `true` reste accepté pour les recettes avec prestataire simulé. Les réservations aux offres payantes, le drapeau par espace et la coupure depuis la console sont inchangés.

### Reste non prouvé

Trente dictées réellement enregistrées, transcription avec bruit, essais sur téléphones physiques, nombre de corrections mesuré par des coachs, et revue des textes libres (titres, notes). La clé OpenAI utilisée reste à faire tourner.

## Évaluations du 8 novembre 2026

**À cette date, la bêta IA n’était pas validée.** Le code du parcours est présent et isolé, mais l’évaluation révèle encore des erreurs d’interprétation.

## Protocole et résultats

Le corpus de 60 consignes fictives a été figé dans `5a4e249` avant les premiers appels réels : 30 propositions attendues et 30 cas de clarification, avec 32 rattachements d’exercices attendus dans les propositions. Les mêmes consignes et attendus ont été utilisés pour les passes suivantes. Les 30 scripts oraux sont du texte, **pas trente enregistrements humains**.

| Passe | Modèle | Cas évalués | Cas strictement réussis | Exercices correctement rattachés dans les propositions | Clarifications avec état et champ attendus |
| --- | --- | ---: | ---: | ---: | ---: |
| Référence | gpt-4.1-mini | 60 | 29 | 9 / 32 | 20 / 30 |
| Clarifications resserrées | gpt-4.1-mini | 60 | 47 | 30 / 32 | 20 / 30 |
| Conventions explicitées | gpt-4.1-mini | 60 | 47 | 29 / 32 | 20 / 30 |
| Comparaison exploratoire | gpt-5.4-mini-2026-03-17 | 12 cas sélectionnés | 9 | 4 / 4 | 5 / 8 |

La dernière ligne n’est pas comparable au taux global : elle ne couvre que douze cas sélectionnés. Les résultats et empreintes exacts de ces passages sont dans `corpus-ia-2026-11-08.json`, désormais retiré du dépôt et conservé dans l’historique git. Les réponses détaillées, toutes fictives, restent dans les rapports `.local` ignorés par Git. L’évaluation ne crée aucune séance et ne contacte aucune base. Les tests de service et d’API restent les preuves des droits et des écritures.

Le score est strict sur les champs : une question sémantiquement pertinente portant l’étiquette `exercise` au lieu de `unit` est comptée en échec. Plusieurs échecs portent sur cette classification, mais d’autres sont substantiels : date supposée, variante guidée assimilée à la barre libre, charge habituelle laissée indéfinie sans question, correction explicite redemandée et demande tronquée. Il serait trompeur de transformer ces résultats en promesse globale de précision.

## Correctifs issus des mesures

La liste de collisions transmise au modèle était trop large : elle signalait des ambiguïtés d’exercices non présents dans la consigne ou déjà désignés par leur nom complet. Elle est maintenant limitée aux occurrences non résolues repérées. La validation finale des brouillons est distinguée de la clarification d’une consigne, pour éviter les demandes de confirmation inutiles. Les noms complets et alias uniques priment sur leurs mots communs.

Les descriptions du contrat précisent séries/passages, répétitions, distance et durée par passage, contacts totaux. Les corrections orales explicites, les limites de période, les demandes de conversion RPE/RIR et l’interdiction de résoudre une ambiguïté critique par une simple hypothèse sont explicitées. Le serveur transforme une date ou cible hors périmètre en question sans séance, sans substitution et sans nouveau passage automatique chez le prestataire.

Après ces changements : **36 tests ciblés** de prestataire, propositions et évaluateur réussis en 6,22 s ; types du monorepo et lint ciblé réussis. Ces tests ne valent pas réussite du corpus. La CI du prédécesseur web `7df9363` est entièrement verte : qualité `42456681343` en 27 min 34 s, Android `42456680822` en 20 min 43 s et Preview Vercel prête. Le présent lot exige ses propres checks.

## Travail restant

Le contexte de matériel/convention et la résolution locale des noms dans les questions et citations sont désormais implémentés : voir [la preuve complémentaire](lot-e-contexte-exercices.md). La précision reste insuffisante : poursuivre les contrôles de fidélité, les questions réellement utiles et le traitement des dates/périodes. La copie des titres et notes vers les brouillons résout maintenant les jetons sans troncature, avec correction explicite des longueurs : [preuve complémentaire](lot-e-textes-brouillons.md).

Il reste aussi les trente dictées consenties/scénarisées effectivement enregistrées, la transcription avec bruit et interruptions, les essais sur téléphones et le nombre de corrections mesuré par les coachs. Les notes, titres et suggestions demandent une revue sémantique, dont la recherche d’une force individuelle inventée dans le texte libre. L’absence de champ « maximum individuel » dans le JSON ne suffit pas à prouver cette absence partout.

Le modèle alternatif a été essayé uniquement dans le processus d’évaluation. Sa compatibilité avec Responses et les sorties structurées a été vérifiée dans la [documentation OpenAI](https://developers.openai.com/api/docs/models/gpt-5.4-mini) ; aucun changement de modèle, de tarif ou de drapeau n’a été appliqué à un espace utilisateur.


## Complément — contexte matériel et conventions

Le contexte synthétique a été enrichi des classifications et conventions de ses onze fiches. **Les soixante consignes et leurs attendus restent inchangés.** L'empreinte du corpus change explicitement ; les résultats suivants mesurent ce nouveau contexte et ne sont pas présentés comme une simple répétition à entrée identique.

| Modèle | Cas strictement réussis | Rattachements réussis | Clarifications avec état et champ attendus |
| --- | ---: | ---: | ---: |
| gpt-4.1-mini | 52 / 60 | 29 / 32 | 24 / 30 |
| gpt-5.4-mini-2026-03-17 | 49 / 60 | 29 / 32 | 22 / 30 |

Un passage complet par modèle, sans réessai sélectif des échecs. Pour le second modèle, douze cas ont été joués, puis les quarante-huit restants par reprise du même rapport et de la même signature. Le cas C03 (machine guidée absente de la bibliothèque) demande une précision dans les deux passes. Le modèle initial est conservé et l'IA demeure désactivée.

Échecs substantiels encore observés : récupération/charge habituelles laissées indéfinies sans question, mauvaise résolution de « hier », demande quotidienne sur huit jours tronquée. Des citations altérées sont rejetées par le validateur, et quelques questions sémantiquement pertinentes sont classées dans un champ différent de l'attendu. La convention additionnelle de la fiche « Tractions » suscite aussi une question pour la demande au poids du corps : ce cas doit être traité explicitement, sans assimiler assistance, charge additionnelle et poids corporel. Les textes libres restent à examiner ; le score ne prouve pas la fidélité complète d'une séance.
