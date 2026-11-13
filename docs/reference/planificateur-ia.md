# Planificateur IA

Le coach écrit ou dicte une consigne, ou renseigne un brief de proposition. Le serveur appelle OpenAI, contrôle la réponse et renvoie une clarification ou une séance à relire. Le coach corrige, prévisualise l’ordre et les charges, puis crée des brouillons. Rien n’est publié automatiquement. L’état de qualification daté se lit dans [ETAT.md](../ETAT.md).

## Deux modes

- **Mettre en forme ma séance** conserve les mouvements, quantités, charges, dates et destinataires de la consigne relue. Une donnée importante ambiguë doit devenir une question. Chaque exercice conserve une citation de la demande ; une suggestion ne modifie pas silencieusement la prescription.
- **Proposer une séance** demande objectif, date, durée maximale, niveau, matériel et destinataires. Il utilise uniquement les fiches communes dont le guide porte `technicalReview: approved`. Le serveur filtre le matériel et rejette une fiche de matériel inconnu ou indisponible. Les noms français usuels et les clés de classification sont acceptés ; une appellation approximative ne donne pas accès à un autre appareil. Les charges sont nulles dans le schéma demandé au modèle et à nouveau contrôlées côté serveur. Les volumes et intensités proposés sont relus par le coach.

Un catalogue rédigé mais non validé n’ouvre pas le second mode. Le jeu synthétique utilisé pour évaluer le prestataire ne change pas cette règle dans l’application.

## Exercices inconnus et circuits

Une clarification peut contenir `exerciseName`, le nom inconnu conservé depuis la demande. Le coach choisit une fiche, reformule, ou ouvre une fiche privée préremplie. La création exige une relecture explicite. Elle est réservée aux utilisateurs autorisés à modifier la bibliothèque, reste dans l’espace et ne devient jamais une fiche commune automatiquement. En mode proposition, seules les fiches communes approuvées peuvent être choisies ; la création privée n’est pas disponible.

`POST /api/v1/orgs/:orgId/planner/proposals/:proposalId/resolve-exercise` vérifie propriétaire, accès, version, question et périmètre. Une même opération, ou le même choix rejoué après perte de réponse pour le même tour de clarification, ne crée pas de deuxième exercice. Une correspondance choisie est conservée pour la reprise. L’enregistrement n’appelle pas OpenAI et ne consomme pas une nouvelle proposition.

La bibliothèque entière peut servir à rechercher des candidats ; 150 candidats pertinents sont transmis par défaut. Une sélection explicite reste bornée à 500 fiches. La recherche ne décide jamais seule qu’un mouvement voisin est un synonyme.

Les exercices portent des références stables. Une structure partagée décrit exercices, récupérations et groupes répétés, avec deux niveaux de groupes maximum. Les séries appartiennent à l’exercice ; les tours appartiennent au groupe. La projection vers les brouillons et leurs occurrences utilise `packages/domain`, notamment pour conserver A/B/A/B et les adaptations de charge de chaque tour. Les anciens clients ne peuvent pas enregistrer une version aplatie qui effacerait cette structure.

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

Conservation : transcription 24 h ; proposition abandonnée sept jours ; après création des brouillons, le plus tôt entre 24 h après conversion et sept jours après création. Tartan ne conserve pas l'audio. `store:false` ne garantit pas une rétention nulle chez OpenAI : c'est une question du dossier juridique.

## Modèles

`gpt-4.1-mini` pour la planification, `gpt-transcribe` pour la dictée (`AI_PLANNER_MODEL`, `AI_TRANSCRIPTION_MODEL`). Depuis le 12 novembre 2026, `gpt-transcribe` remplace `gpt-4o-mini-transcribe`, arrêté par OpenAI le 26 février 2027. Il reçoit la langue dans `languages[]`, le vocabulaire dans `keywords[]` et un contexte court dans `prompt`. Prix annoncé : 0,0045 $ la minute, contre 0,003 $ pour l'ancien. Si `AI_TRANSCRIPTION_MODEL` est défini sur Vercel avec l'ancien nom, il faut le retirer ou le mettre à jour. Non éprouvé sur une vraie dictée. Le fondateur conserve la clé actuelle (décision du 13 novembre) ; la qualification réelle reste à faire.

## Essais de l'app native

Le job `maestro` de la CI mobile joue le planificateur de l'app contre un serveur local : `AI_PLANNER_FAKE_PROVIDER=true` y remplace OpenAI par `src/server/ai/fake-provider.ts`, qui propose une séance à partir du contexte reçu. Ce réglage est sans effet sur Vercel et refusé en production par `assertEnvIsolation`.

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

## Qualification des nouveaux parcours

Le corpus historique de 60 cas reste une régression. Le corpus `apps/web/evals/independent/planner-80.json` contient 80 cas figés et une empreinte vérifiée avant chaque exécution. Il couvre les deux modes, les exercices inconnus, les circuits et les ambiguïtés. Seules la consigne et les données de contexte sont envoyées au modèle ; les attendus servent uniquement à la notation.

```sh
corepack pnpm --filter @tartan/web eval:planner:independent
corepack pnpm --filter @tartan/web eval:planner:independent --live --output .local/planner-independent-reference.json
corepack pnpm --filter @tartan/web eval:planner:independent --live --resume .local/planner-independent-reference.json
```

Sans `--live`, aucun appel externe. Par défaut, trois passages avec au plus trois cas simultanés. La reprise exige les mêmes empreintes de corpus, d’implémentation et de modèle. Le rapport local contient réponses synthétiques, écarts, durées et nombre d’appels. Aucun compte ni donnée d’athlète réel n’est utilisé. Pour corriger une erreur de notation sans refaire les appels, `--rescore .local/source.json --output .local/nouveau.json` garde le rapport original et indique l’empreinte du correcteur.

Seuil attendu : au moins 76/80 à chacun des trois passages, aucune date fausse, charge inventée ou substitution silencieuse acceptée. Un défaut de structure ou de quantité reste un échec même lorsqu’il ne constitue pas une substitution. Après observation des réponses et réglage, ce corpus devient lui aussi une régression : sa provenance reste indiquée, sans le présenter comme un nouveau jeu indépendant.

Une réussite automatique ne clôt pas la qualification : 30 dictées humaines sur appareils, des essais bruités et la relecture des propositions par des coachs restent nécessaires. La génération de propositions est évaluée avec un catalogue synthétique au niveau prestataire ; cela ne prouve ni la validation éditoriale des fiches ni tout le parcours applicatif.

## Reprises et coût

Une opération logique consomme une proposition du quota utilisateur. Une date omise, une structure invalide ou une substitution détectée peut déclencher une seule reprise technique. Les deux appels partagent un délai de 100 secondes et le plafond est contrôlé globalement : plusieurs motifs d’erreur ne multiplient pas les reprises. Tartan supporte le coût du second appel. Le modèle configuré reste inchangé tant qu’une comparaison documentée n’a pas justifié son remplacement.
