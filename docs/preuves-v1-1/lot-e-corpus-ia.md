# Lot E — corpus réel du prestataire, 8 novembre 2026

**La bêta IA n’est pas validée.** Le code du parcours est présent et isolé, mais l’évaluation révèle encore des erreurs d’interprétation. Le drapeau global demeure désactivé et le modèle initial n’est pas changé.

## Protocole et résultats

Le corpus de 60 consignes fictives a été figé dans `5a4e249` avant les premiers appels réels : 30 propositions attendues et 30 cas de clarification, avec 32 rattachements d’exercices attendus dans les propositions. Les mêmes consignes et attendus ont été utilisés pour les passes suivantes. Les 30 scripts oraux sont du texte, **pas trente enregistrements humains**.

| Passe | Modèle | Cas évalués | Cas strictement réussis | Exercices correctement rattachés dans les propositions | Clarifications avec état et champ attendus |
| --- | --- | ---: | ---: | ---: | ---: |
| Référence | gpt-4.1-mini | 60 | 29 | 9 / 32 | 20 / 30 |
| Clarifications resserrées | gpt-4.1-mini | 60 | 47 | 30 / 32 | 20 / 30 |
| Conventions explicitées | gpt-4.1-mini | 60 | 47 | 29 / 32 | 20 / 30 |
| Comparaison exploratoire | gpt-5.4-mini-2026-03-17 | 12 cas sélectionnés | 9 | 4 / 4 | 5 / 8 |

La dernière ligne n’est pas comparable au taux global : elle ne couvre que douze cas sélectionnés. Les résultats et empreintes exacts sont dans [le rapport réduit](corpus-ia-2026-11-08.json). Les réponses détaillées, toutes fictives, restent dans les rapports `.local` ignorés par Git. L’évaluation ne crée aucune séance et ne contacte aucune base. Les tests de service et d’API restent les preuves des droits et des écritures.

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
