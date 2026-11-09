# Planificateur IA

Le coach écrit ou dicte une consigne. Le serveur envoie la demande à OpenAI et reçoit une proposition structurée. Le coach relit, corrige, puis crée des brouillons. Rien n'est publié sans action humaine.

## Accès

- Une clé OpenAI sur le serveur, sauf `AI_PLANNER_ENABLED=false` qui coupe tout.
- Drapeau de l'espace (`ai_planner_enabled`), offre différente de Découverte, droit `manageSessions`.
- Accord explicite de l'utilisateur, nommant OpenAI et les États-Unis, retirable (`profiles.ai_consent_at`). Exigé par le serveur avant tout appel, et par la règle Apple 5.1.2(i).
- Coupe-circuit : `/admin` → Couper l'IA partout.

## Quotas et limites

| Offre | Propositions par mois | Dictée par mois |
| --- | ---: | ---: |
| Pilote, Coach | 30 | 60 min |
| Club | 150 | 300 min |
| Découverte | 0 | 0 |

Audio : 3 Mio et 180 secondes au plus. Pas de dépassement payant. Règle pure : `packages/domain/src/ai-planner.ts`.

## Données

Envoyés : le texte, le nom des exercices de la bibliothèque, l'audio d'une dictée. Les noms des groupes et athlètes sélectionnés sont remplacés par des jetons, mais un texte libre peut en contenir d'autres, d'où la consigne de ne citer ni athlète ni donnée de santé.

Conservation : transcription 24 h, proposition abandonnée 7 jours, 24 h après création des brouillons. Tartan ne conserve pas l'audio. `store:false` ne garantit pas une rétention nulle chez OpenAI : c'est une question du dossier juridique.

## Modèles

`gpt-4.1-mini` pour la planification, `gpt-4o-mini-transcribe` pour la dictée (`AI_PLANNER_MODEL`, `AI_TRANSCRIPTION_MODEL`). Le modèle de transcription est annoncé arrêté le 26 février 2027 : à remplacer avant (A11).

## Déploiement

Migrer avant de déployer le code : le cron lit les tables IA même coupées. En retour arrière, conserver les tables.

## Évaluer

Corpus versionné : `apps/web/evals/planner-corpus.ts`, 60 consignes fictives, dont 30 propositions attendues et 30 ambiguïtés. Les 30 premières servent aussi de scripts à enregistrer : elles ne sont pas des dictées humaines tant que les enregistrements n'existent pas.

```sh
corepack pnpm --filter @tartan/web eval:planner
corepack pnpm --filter @tartan/web eval:planner --live --ids P01,P03,C01 --output .local/planner-eval-reference.json
corepack pnpm --filter @tartan/web eval:planner --live --resume .local/planner-eval-reference.json
```

La première commande n'appelle pas le réseau. Un rapport contient commit, empreintes, modèle, latences, réponses fictives et différences. Pour mesurer une nouvelle version, crée un autre rapport. N'ajuste jamais les attendus après avoir vu les réponses. N'alimente jamais le corpus avec de vraies données d'athlètes.

**Seuils :** au moins 57/60, 0 date fausse, 0 charge inventée.

| Passage du 9 novembre 2026 | Réussis | Dates fausses | Charges inventées |
| --- | ---: | ---: | ---: |
| Base | 48/60 | Non mesuré | Non mesuré |
| Final, garde-fous déterministes | 59/60 | 0 | 0 |

**Limites de ce chiffre.** Les contrôles ont été écrits en regardant les échecs de ce corpus : il n'est plus un jeu indépendant. Le modèle reste variable d'un passage à l'autre, même à température 0 : un rejeu a produit 58/60 et une charge inventée, d'où un contrôle déterministe ajouté. Seize cas supplémentaires, écrits avant de voir les réponses, donnent 13/16, sans date fausse ni charge inventée. Échec restant : C22, athlète hors périmètre, où le coach reçoit une erreur au lieu d'une question.

Le rapport reste `betaQualified: false` tant que 30 enregistrements, essais de bruit sur appareils, revue humaine et corrections réelles de coachs ne sont pas documentés (A12).

## Décision ouverte

Quand un jour cité manque, le serveur redemande une seule fois au modèle. Le coach ne paie qu'une proposition, Tartan paie un appel de plus. À confirmer ou à retirer selon le coût observé.
