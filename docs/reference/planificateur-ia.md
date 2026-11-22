# Planificateur IA

Le coach écrit ou dicte ce qu’il veut, dans un seul champ. Le serveur comprend la demande, retrouve les fiches, compose la séance, la contrôle, puis rend une séance à relire. Le coach la corrige dans l’éditeur du constructeur et crée des brouillons. Rien n’est publié automatiquement. L’état de qualification daté se lit dans [ETAT.md](../ETAT.md).

Depuis le 21 novembre 2026, le serveur travaille en **quatre étapes** (lot P2). L’ancien appel unique, ses deux modes et sa coupe à 150 fiches n’existent plus.

## Les quatre étapes

Le code vit dans `apps/web/src/server/ai/pipeline/`. `runPlannerPipeline(context, provider, events)` les enchaîne sans toucher à la base ; `proposal.service.ts` construit le contexte, lit les termes appris, enregistre le résultat et adapte la réponse aux anciens clients. L’adaptateur OpenAI (`provider.ts`) ne fait que quatre appels typés : `understand`, `match`, `compose`, `repair`. Le prestataire simulé (`fake-provider.ts`) implémente les mêmes quatre fonctions et passe par les mêmes contrôles.

| Étape         | Fichier         | Modèle                 | Ce qu’elle fait                                                                                                                                                                                                                                                                                     |
| ------------- | --------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Comprendre | `understand.ts` | rapide                 | Lit la demande, **sans la bibliothèque**. Rend la nature de la demande, les séances (date, heure, destinataires cités, mouvements cités avec le terme exact et la prescription dite, structure, partie à proposer), les corrections orales, et le résumé « Ce que j’ai compris », diffusé à mesure. |
| 2. Retrouver  | `match.ts`      | règles, puis rapide    | Associe chaque terme cité à une fiche. Règles d’abord : terme appris par l’espace, nom exact, alias exact. Les termes restants partent en **un seul appel** avec toute la bibliothèque (clé, nom, alias, famille, matériel).                                                                        |
| 3. Composer   | `compose.ts`    | rapide ou principal    | Écrit la séance, diffusée ligne à ligne. Reçoit la compréhension, les fiches retrouvées, 20 à 40 fiches candidates choisies par règles pour la partie à proposer, et le contexte.                                                                                                                   |
| 4. Contrôler  | `check.ts`      | règles, puis principal | Applique les règles de `packages/domain/src/planner-guards.ts`. Un défaut déclenche une réparation ciblée, deux au plus : le modèle reçoit sa réponse fautive et la liste précise des défauts.                                                                                                      |

### 1. Comprendre

La sortie stricte est `plannerUnderstanding` (`packages/contracts/src/ai-planner-pipeline.ts`). Le modèle ne tranche rien seul : `plannerNormalizeUnderstanding` (`packages/domain/src/planner-understanding.ts`) relit sa réponse par règles.

- **Nature.** `described` (tout est décrit), `objective` (tout est à composer) ou `mixed`. Elle se lit dans le contenu, pas dans un mode choisi à l’écran.
- **Dates.** Une date écrite par le coach l’emporte sur celle du modèle. Un jour de semaine donne sa première occurrence. Une date du modèle n’est gardée que si elle s’appuie sur des mots du coach. « Du lundi au vendredi » et « tous les jours » donnent une séance par jour. Aucune date n’est inventée : sans date déductible, la séance porte un blocage nommé.
- **Destinataires.** Les groupes et athlètes sont remplacés par des jetons. Un jeton n’est jamais un mouvement. Quand le coach n’a choisi personne à l’écran, tous les groupes et athlètes qu’il peut voir deviennent candidats : il faut qu’il en cite un, sinon c’est une question.
- **Mouvements.** Chaque mouvement cité garde le terme du coach (`said`) et sa prescription dite, dans l’ordre où la séance se déroule : un exercice annoncé après coup (« et avant tout ça, dix minutes de footing ») prend la place que le coach lui donne. Une mention elliptique est complétée pour être comprise seule (« puis des lancers en rotation » après des lancers de médecine-ball). Sont aussi des mouvements : une routine que le coach appelle par son nom, une course écrite en notation (« 2 x (6 x 200 m) »), un travail vague auquel il donne une quantité (« des abdos 3 séries de 20 »). Une consigne dite pour toute la séance (« trente secondes entre chaque exercice ») est recopiée dans la prescription de chaque mouvement concerné.
- **Mouvement annoncé par son nombre.** « …puis fentes 3 x 10 ; puis 8 lancers vers l’avant » : le dernier mouvement est un mouvement à part, avec son nombre pour prescription, jamais la suite de la prescription précédente. La consigne du modèle le dit, et une règle le vérifie (`plannerKeepNumberLedMentions`, `packages/domain/src/planner-understanding.ts`) : une clause qui commence par un nombre (en chiffres ou en lettres, sauf « un » et « une », qui sont d’abord des articles) suivi d’un nom de mouvement, et qu’aucun mouvement compris ne porte, entre dans la séance juste après le mouvement qui la précède. Si la prescription de celui-ci l’avait avalée (« 3 x 10 ; puis 8 lancers… », ou « 3 x 10 ; puis 8 »), elle en est retirée. Ne comptent pas : une unité ou une quantité (« 2 minutes de récup », « 3 tours », « 3 séries de 10 »), une durée en notation (« 5' entre les séries »), une charge (« deux à soixante-dix »), une demande à composer (« 3 exercices de gainage »). Sans mouvement cité avant elle, rien n’est ajouté.

### 2. Retrouver

Sortie par terme : `exact` (règle), `sure` ou `probable` avec trois autres fiches au plus, ou `absent`. Règles pures dans `packages/domain/src/planner-match.ts`.

**La confiance se décide par règle, pas par le modèle** (depuis le 22 novembre 2026). Pour chaque terme, le modèle donne jusqu’à quatre fiches, la meilleure d’abord, chacune avec sa **relation** au terme (`plannerMatchJudgement`, `packages/contracts/src/ai-planner-pipeline.ts`) ; `plannerMatchVerdict` en déduit la confiance :

| Relation dite par le modèle                                                                                                                                                                                                                                | Confiance                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `same_name` : le nom, un alias ou leur traduction directe portent l’équivalence (abréviation, faute, pluriel, ordre des mots compris). Seule fiche donnée pour ce mouvement.                                                                               | `sure`                                    |
| `same_known` : le même mouvement, mais seule la connaissance du modèle le dit (« chaise au mur » pour « Squat isométrique contre le mur »).                                                                                                                | `probable`                                |
| `variant` : le même geste, à une précision de matériel, d’agrès, de lest ou de position près, ou sous un synonyme d’entraîneur, ou en plus général (« squat à la barre guidée » pour « Squat arrière », « footing lent » pour « Course continue facile »). | `probable`                                |
| Deux fiches `same_name` ou `same_known`                                                                                                                                                                                                                    | `probable`, la seconde proposée           |
| Seulement des `neighbor` (un autre geste, voisin), ou aucune fiche                                                                                                                                                                                         | `absent`, les voisines proposées au coach |

Une équivalence que seul le modèle connaît n’est donc jamais posée sans la marque « À vérifier » : si elle est fausse, le coach le voit. À l’inverse, un terme qui ne diffère de la fiche que par une précision qui ne change pas le geste n’est plus laissé absent. Les règles sans modèle (terme appris, nom exact, alias exact) passent toujours avant ce verdict.

- **Clé d’un terme** (`plannerTermKey`) : sans accent, casse, pluriel, ponctuation ni trait d’union, sans déterminant ni possessif de tête, petits nombres en chiffres. « talons fesses », « 90 90 », « trois appuis » et « ma routine épaules » retrouvent « talons-fesses », « 90/90 », « 3 appuis » et l’alias « routine épaules ». Ce qui suit les deux-points d’un nom (« Gammes : talons-fesses ») vaut un alias.
- **Copie de l’espace.** Une fiche copiée du catalogue se retrouve aussi sous le nom et les alias de la fiche commune qu’elle représente : les fiches de départ sont copiées sans leurs alias (`context.ts`).
- **Le modèle juge le geste, pas le nom.** Un mot de catégorie ou de zone (« du cardio », « des abdos ») n’est pas une fiche : seulement des voisines, donc `absent` avec des propositions. Entre plusieurs fiches du même mouvement, la plus simple d’abord : pas la variante qui ajoute un matériel que le coach n’a pas dit. Un éducatif, une variante nommée ou un geste précis que la bibliothèque n’a pas (« pompes claquées », « planche Copenhague », « soulevé de terre jambes tendues ») est `neighbor` de sa fiche de base : il ne s’y rabat jamais, même marqué.
- Le modèle reçoit, avec chaque terme, les mentions voisines de la même séance (`near`).
- Deux fiches qui portent le même nom ou le même alias donnent `probable`, jamais un choix silencieux.
- Jusqu’à 600 fiches, le modèle reçoit la bibliothèque entière. Au-delà, un préfiltre garde les fiches utiles sans jamais écarter une fiche qui partage un mot avec un terme cherché. La bibliothèque lue est bornée à 5 000 fiches.
- Pour un terme `absent`, l’étape rend de quoi préremplir une création de fiche : nom proposé (le terme du coach, sans prescription), catégorie, famille de mouvement et type de charge les plus probables.
- L’étape est exposée seule : `matchPlannerTerms(userId, organizationId, terms)` dans `proposal.service.ts`. L’outil de mesure s’en sert pour les paires.

### 3. Composer

Règles dures, écrites dans la consigne et vérifiées à l’étape 4 :

- Dans ce que le coach a décrit, rien n’est modifié ni ajouté. L’ordre est gardé.
- Dans ce qui est proposé, **jamais de kilos**. Un pourcentage du maximum n’est admis que si tous les destinataires ont leur référence de force sur la fiche ; aucune valeur de maximum n’est transmise.
- Aucune date : la date, l’heure et les destinataires viennent de la compréhension, le modèle ne les écrit pas.
- Une fiche citée par le coach n’est pas proposée une seconde fois.

Le modèle rend un seul arbre ordonné (`plannerComposition`) : exercice, récupération, ou groupe répété, deux niveaux de groupes au plus. Le serveur en dérive la séance (`plannerCompositionToInterpretation`). Les séries appartiennent à l’exercice, les tours au groupe.

### 4. Contrôler

`plannerCheckComposition` relève les défauts : mouvement cité manquant, exercice ajouté dans une partie décrite, ordre changé, charge jamais dite, séance manquante, structure ou tours faux. Après deux réparations, `plannerSettleComposition` règle ce qui reste sans appel : une charge jamais dite est retirée et marquée « À vérifier ».

- **Rien de dit ne disparaît.** Chaque mouvement de la compréhension a un élément dans sa séance, fiche ou emplacement à compléter, dans l’ordre dit. Celui qui manque encore après les réparations est posé à sa place, avant le mouvement cité qui le suit, avec sa prescription dite en note et le point « À vérifier » `to_complete`.
- **Séries détaillées.** Une unité dite une fois vaut pour toute l’énumération : « 3 reps à 40 kg, 3 à 50, 2 à 55 » garde ses trois charges en kilos. Sans aucune unité dite, rien n’est deviné.
- **Nombres en lettres.** Une charge dictée se lit selon la grammaire du français, jusqu’aux milliers : « soixante-dix », « soixante et onze », « quatre-vingt(s) », « quatre-vingt-dix-neuf », « cent dix », « deux cent cinquante », avec ou sans traits d’union, et « virgule » pour une décimale. Un nombre s’arrête où il s’arrête : dans « deux à soixante-dix une à quatre-vingts », « une » commence un autre nombre, et « quatre-vingts » ou « deux cents » au pluriel ne se prolongent jamais. Une dizaine suivie d’une unité sans ponctuation (« cinquante deux ») garde ses deux lectures. Avant le 22 novembre 2026, « soixante-dix une » se lisait 71 : les charges de 70 et 80 kg d’une montée dictée étaient vidées comme non dites.
- **Fiches permises.** Le schéma de sortie ne liste plus les jetons de la demande (voir « Modèles ») : un exercice proposé qui cite une fiche que le modèle n’a pas reçue disparaît (`plannerCompositionToInterpretation`).

## Face au doute

Le planificateur écrit la séance et marque ses doutes. Il ne pose une question que s’il ne peut rien écrire.

| Situation                             | Ce que fait le serveur                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Fiche `probable`                      | Posée, marquée « À vérifier », avec les autres fiches possibles (`alternatives`).                                        |
| Fiche `absent`                        | Un **emplacement à compléter** à sa place, avec le terme du coach et sa prescription. Le reste de la séance est écrit.   |
| Charge dite sans unité, ou ambiguë    | Champ vide, « À vérifier » (`load_unclear`). Une unité manifestement inversée est corrigée et signalée (`unit_assumed`). |
| Aucune date déductible                | Question, qui nomme la séance concernée.                                                                                 |
| Aucun destinataire, ni choisi ni cité | Question (ce n’est plus une erreur de saisie).                                                                           |
| Demande hors sujet                    | Question.                                                                                                                |

**Emplacement à compléter.** Dans la séance, l’exercice porte un jeton `slot_N` (`PLANNER_SLOT_PREFIX`), son terme (`said`) et une `suggestion` de fiche. La réponse liste les emplacements ouverts (`slots`). `resolvePlannerExercise` remplit un emplacement **sans appel au modèle et sans réponse écrite** : fiche existante, fiche créée (nom modifiable, valeurs préremplies, plus de case de vérification exigée par le serveur), ou emplacement retiré. `confirmPlannerProposal` refuse de créer un brouillon tant qu’un emplacement reste ouvert (409 `planner_slots_open`).

**Fiche « À vérifier ».** `resolvePlannerExercise` tranche aussi une fiche `probable` : `questionId` est alors la référence de l’exercice dans les brouillons préparés, et le choix une fiche existante, la même pour valider, une autre pour changer. La fiche prend la place sans rien réécrire, le point « À vérifier » disparaît, le terme est retenu. Ni création ni retrait par ce chemin.

**Toute la bibliothèque à la relecture.** L’aperçu des charges et la confirmation acceptent toute fiche visible de l’espace (commune ou de l’espace, non supprimée), pas seulement celles que la demande avait figées : le coach ajoute et remplace dans toute sa bibliothèque, y compris par une fiche créée depuis. La fiche d’un autre espace, une fiche supprimée et l’identifiant réservé d’un emplacement restent refusés.

**Termes appris.** Chaque fiche que le coach choisit pour un terme entre dans la table `exercise_term_aliases` (une ligne par espace et par terme, migration additive `20261121120000_exercise_term_aliases`). L’étape 2 la lit en premier ; le vocabulaire de dictée aussi, avec les fiches de l’espace puis les fiches communes à tour de rôle. Un terme appris ne quitte jamais son espace. `GET` et `DELETE /api/v1/orgs/:orgId/planner/aliases` les listent et les retirent, sous `requireOrgMember` (`alias.service.ts`, deux lignes dans la matrice d’accès).

## Un seul champ, et les clients d’avant

Le contrat (`packages/contracts/src/ai-planner.ts`) n’a changé que par ajouts.

- `mode` et `brief` restent acceptés, comme **indices** : `mode: "propose"` suggère une demande à composer, le brief complète la durée, le niveau et le matériel que la demande ne dit pas. Ils ne décident plus de rien.
- La période reste demandée, 28 jours au plus (`PLANNER_MAX_PERIOD_DAYS`). Un client qui envoie un seul jour reçoit une fenêtre de 28 jours à partir de ce jour : le jour de l’écran devient un indice, et la période enregistrée suit la date dite quand elle diffère.
- Un client déclare ce qu’il sait lire dans `accepts` : `slots` (emplacements à compléter), `checks` (nouveaux points « À vérifier »). Le web et l’app native refaite (lot P5) déclarent les deux ; les versions de l’app installées avant elle ne déclarent rien.
- `hints` (additif) porte les précisions facultatives du champ unique : durée, niveau, matériel. Ce sont des indices, comme le brief qu’ils remplacent pour le web : la demande passe avant.
- `sessions` (additif), sur `clarify` et `resolve-exercise` : les séances telles qu’elles sont à l’écran, qui deviennent la base de la suite (voir « Ajuster »).
- **Sans `slots`**, un emplacement ouvert redevient l’ancienne question nommée (`plannerLegacySlots`) : `id = slot_N`, `exerciseName` = le terme du coach. Le parcours « choisir, reformuler ou créer une fiche » des applications installées marche donc sans changement.
- **Sans `checks`**, les nouveaux codes d’alerte ne sont pas servis.

Limites, les mêmes pour toute demande : 12 000 caractères, 14 séances, 28 jours, 12 blocs et 60 exercices par bloc, 5 000 fiches lues. Le choix : une semaine de deux séances par jour tient en 14 séances ; au-delà, la relecture d’un seul tenant n’est plus tenable et la sortie de « Composer » dépasse son délai.

## Contexte transmis

- Profil de l’espace : disciplines, objectifs, matériel.
- Séances de J−14 à J+7 de l’audience, seulement quand une partie est à composer ou qu’une reprise est citée, en champs structurés : date, type, exercices (jeton ou nom de fiche), séries, répétitions, distance, durée, charge prescrite. **Jamais** le titre, une note, la note du coach, une séance réalisée, un effort ressenti, une douleur ou une blessure. Un test vérifie qu’aucune de ces données ne part chez OpenAI.
- Couverture des références de force par fiche ; aucune valeur de maximum.
- Phase d’entraînement planifiée à la date de la séance, par destinataire, quand elle existe.
- Le contexte est figé avec la demande (`bindings`), comme les fiches. Le prestataire ne reçoit qu’une projection stricte (`plannerProviderContext`).

## Pannes lisibles, par étape

Chaque panne garde sa cause (`ai_planner_operations.failure_code`) et son étape (`failure_step`), exposées en champ additif `failure { code, step }` : `configuration` (clé ou modèle refusé, 503), `saturated` (429, 503), `unavailable` (5xx ou réseau, 502), `timeout` (504), `refused` (422), `incomplete` (réponse coupée, 502), `invalid_output` (502). Le message dit l’étape, quoi faire, et « cette demande n’est pas décomptée » : une panne rend toujours la réservation au quota.

- Délais : 25 s pour comprendre, 25 s pour retrouver, 70 s pour composer, 45 s par réparation, 100 s pour la demande entière (`pipeline/step.ts`).
- **Saturation.** Un 429 est rejoué deux fois après l’attente demandée par OpenAI (`retry-after-ms` ou `retry-after`, 8 s au plus), avant de devenir une panne lisible.
- La sortie de chaque étape est validée par son schéma Zod. Une sortie hors schéma est une panne `invalid_output` de cette étape, jamais une séance.

## Réponse diffusée

`POST /planner` et `POST /proposals/:id/clarify` répondent en `text/event-stream` quand le client envoie `Accept: text/event-stream`. Événements : `understanding { summary, done }`, `matching { movements, done }`, `composing { lines }`, `checking { repairs, done }`, puis `result` ou `error { …, step }`. Le JSON d’une seule pièce reste servi aux autres clients, dont les versions de l’app installées avant le lot P5 ; l’app refaite lit le flux (voir « App native »). La génération ne dépend pas de la connexion (`after()`) : un onglet fermé n’interrompt ni les appels ni l’enregistrement, et l’écran relit la proposition après une coupure.

## L’écran web

Refait le 22 novembre 2026 (lot P3). Le code vit dans `apps/web/src/features/planner/`, les textes dans `packages/i18n/src/web/planner.ts` ; `fr.ts` ne garde que ce que l’app native et le serveur affichent. L’écran déclare `accepts: ["slots", "checks"]`. La mention « bêta » reste, dans le titre et la pastille, jusqu’à la qualification.

**La demande** (`planner-request.tsx`). « Pour qui ? », « Quand ? », puis **un seul champ** : « Décris ta séance, ou dis ce que tu veux travailler ». Trois exemples, visibles tant que le champ est vide, montrent les trois usages (une séance décrite, un objectif, un mélange) et le remplissent d’un geste. L’écran n’envoie ni `mode` ni `brief`.

- Quand l’espace n’a qu’un groupe, il est déjà choisi : la demande part en un champ et un clic. Aucun destinataire choisi n’empêche pas l’envoi : le planificateur lit ceux que la demande cite, ou pose la question.
- Le jour de l’écran est un indice : si la demande en cite un autre, c’est lui qui vaut.
- **Préciser**, replié et facultatif : heure, durée, niveau, matériel. Ils partent dans `hints` (durée, niveau, matériel seulement s’il diffère du profil de l’espace) et `startTime` ; ce que la demande dit passe avant.
- **Le micro est dans le champ** (`web-dictation.tsx`, un crochet). Aucune case à cocher : l’accord du planificateur, donné une fois, dit que la dictée est transcrite par le même prestataire (`planner-consent.tsx`). Aucune colonne n’a été ajoutée : l’accord existant (`profiles.ai_consent_at`) couvrait déjà « ce que tu écris ou dictes », le serveur l’exige avant toute transcription, et l’écran envoie toujours `audioProcessingAccepted`, que le contrat demande.
- La phase de préparation n’est demandée qu’ici, pour le jour choisi, et seulement si un destinataire est choisi. Dans la séance, elle n’est redemandée que si le coach change la date ou les destinataires.
- Une seule limite de longueur : 12 000 caractères.

**La séance** (`planner-result.tsx`, `planner-review.tsx`). En tête, « Ce que j’ai compris » (le résumé du serveur), puis la séance dans l’éditeur de séquence du constructeur. Chaque exercice dit son état à sa place :

| État | Ce que montre l’écran | Ce que fait le coach |
| --- | --- | --- |
| Reconnu | Rien de plus. | Rien. |
| Rapproché | « À vérifier », avec le terme dit, sous la carte de l’exercice. | « C’est la bonne fiche », une autre fiche possible en un geste, ou « Chercher une autre fiche » dans toute la bibliothèque. |
| À compléter | Une carte en pointillés, à sa place, avec le terme dit et sa prescription. | « Choisir une fiche » (la recherche part du terme dit), « Créer la fiche » (nom, famille et charge déjà proposés, puis « Créer et utiliser »), ou « Retirer ». |

Aucune réponse écrite, aucune case, aucune relance : chaque geste appelle `resolve-exercise`, la séance se met à jour sur place, et le terme est retenu. Tant qu’un exercice attend sa fiche, le bouton du bas ne crée pas le brouillon : il dit lequel (« Compléter « … » ») et y mène ; l’aperçu des charges attend aussi. Au clavier, le focus revient après chaque geste sur l’exercice concerné, ou sur le titre de la séance après un retrait.

Une fiche créée depuis la séance passe par une action du serveur, qui rend la page de nouveau : `WebPlanner` garde alors son travail, et ne repart de la page que si l’adresse désigne une autre proposition (`routeProposal`).

- **Ajouter et remplacer** passent par `ExerciseFinder`, sur toute la bibliothèque, création comprise. `SequenceEditor` reçoit pour cela `extras` : un nom, une carte ou une note qu’un écran ajoute à un exercice, sans que l’éditeur en connaisse le sens.
- **L’aperçu des charges** (`planner-loads.tsx`) reste ouvert : à chaque retouche il se met à jour sur place, l’athlète ouvert reste ouvert.
- **Mes termes** (`planner-aliases.tsx`), replié sous la demande : ce que l’espace a appris, et le moyen d’en retirer un.

**Accès.** Un bouton « Avec le planificateur » sur `/seances/nouvelle` (il garde le jour et le groupe), le lien du même nom dans l’étape « Créer une séance » de « Pour démarrer » et de `/premiers-pas`, et, sur téléphone, le bouton du calendrier placé juste après « Nouvelle séance ». L’icône de l’en-tête reste.

## App native

Refaite le 22 novembre 2026 (lot P5), sur le modèle de l’écran web : mêmes deux temps, mêmes états, adaptés au toucher. Le code vit dans `apps/mobile/src/features/` (`native-planner.tsx` enchaîne les deux temps, `planner-request.tsx`, `planner-progress.tsx`, `planner-result.tsx`, `planner-draft-review.tsx`, `planner-exercise-finder.tsx`), la logique pure dans `apps/mobile/src/lib/planner-flow.ts` et `planner-stream.ts`, avec leurs tests Vitest. Les textes sont dans `packages/i18n/src/fr.ts` (`aiPlanner.screen`) : l’app n’importe jamais `@tartan/i18n/web`. La mention « bêta » reste, dans le titre et la pastille, jusqu’à la qualification.

**La demande, en un écran.** « Pour qui ? » (pastilles de groupes, athlètes repliés), « Quand ? », puis un seul champ multiligne, le micro posé dedans. Quand l’espace n’a qu’un groupe, il est déjà choisi. « Préciser (facultatif) », replié : heure, durée, niveau, matériel en pastilles, repris du profil de l’espace (`hints`, comme le web). La phase du jour n’est demandée que si un destinataire est choisi. Le bouton « Préparer la séance » est collé au bas de l’écran. Ni écran de mode, ni étape « Continuer avec ces destinataires », ni case « J’ai relu » : l’app envoie `reviewed: true` parce que le contrat l’exige encore, comme le web. La dictée n’a plus sa case d’accord : l’accord du planificateur, donné une fois, la couvre (une phrase l’ajoute à l’écran d’accord) ; l’app envoie toujours `audioProcessingAccepted`.

**Réponse diffusée.** Le `fetch` de React Native ne lit pas un corps de réponse au fil de l’eau : l’app passe par celui d’Expo (`expo/fetch`, déjà dans le binaire), avec `Accept: text/event-stream` (`openPlannerStream`, `src/lib/api.ts`). « Ce que j’ai compris », les étapes (la courante annoncée au lecteur d’écran) et le plan de la séance s’affichent pendant la génération. Si le flux ne se lit pas (coupure, arrière-plan, réponse JSON), la proposition se relit toutes les trois secondes, deux minutes au plus, sans être relancée.

**La séance.** Préparée dès son arrivée, sans geste, puis relue dans l’éditeur de séquence du constructeur natif (`NativeSequenceEditor`, qui reçoit pour cela `extras` et `picker`, sans changement pour le constructeur). Chaque exercice dit son état à sa place : reconnu, rien de plus ; « À vérifier », avec « C’est la bonne fiche », les autres fiches possibles en un geste et « Chercher une autre fiche » ; à compléter, une carte en pointillés avec le terme dit et sa prescription, et « Choisir une fiche », « Créer la fiche », « Retirer ». Aucune réponse écrite, aucune relance. Le bouton du bas dit ce qui reste (« Compléter « … » ») et ouvre la recherche de cet exercice ; ensuite seulement il crée le brouillon. « Remplacer l’exercice » est dans les options avancées de chaque exercice.

**Chercher et créer.** La recherche porte sur toute la bibliothèque de l’espace, que l’API rend en entier aux applications, sans accent ni majuscule, par le nom et les autres noms ; sans saisie, les fiches proches du terme dit viennent d’abord. La création rapide passe par `POST /api/v1/orgs/:orgId/exercises/quick` (`api.quickCreateExercise`) : nom prérempli et modifiable, famille et charge préremplies par la suggestion du serveur (sinon par `suggestExerciseDefaults` sur la bibliothèque), un seul bouton « Créer et utiliser ». Une fiche qui porte déjà ce nom est proposée à la place. La fiche est ensuite posée par `resolve-exercise` (`existing`), qui retient le terme. Créer une fiche absente, de la consigne au brouillon : quatre gestes et une saisie (la consigne) : « Préparer la séance », « Créer la fiche », « Créer et utiliser », « Créer le brouillon ». L’ancien parcours en demandait douze et deux saisies (la consigne, puis une réponse écrite) : « Continuer avec ces destinataires », « J’ai relu », « Préparer une proposition », « Créer un exercice privé », « J’ai vérifié le mouvement… », « Enregistrer et rattacher », « J’ai relu », « Envoyer ces précisions », « Relire et ajuster les brouillons », « Vérifier les charges individuelles », « J’ai vérifié les dates… », « Créer 1 brouillon ».

**Relecture.** Plus de case « J’ai vérifié… ». L’aperçu des charges n’est exigé que s’il y a un pourcentage du maximum ; il attend que chaque exercice ait sa fiche. **Ajuster** envoie la séance à l’écran (`sessions`) : les retouches sont gardées.

**Accès.** Le bouton « Planificateur IA » du calendrier. Un coach sans accès voit « Le planificateur IA n’est pas activé pour cet espace. », sans prix ni lien d’achat ; un quota atteint le dit, sans offre.

## Ajuster

« Ajuster » envoie la séance actuelle (`previous`, en jetons) et la modification à part (`adjustment`). Les exercices et les charges de la séance actuelle ne comptent ni comme inventés ni comme ajoutés. Les ajustements ont leur compteur (`adjustment_count`, cinq au plus), distinct des cinq précisions ; ni l’un ni l’autre ne consomme de quota.

**La séance à l’écran est la base.** Le web envoie avec l’ajustement les séances telles qu’elles sont à l’écran (`sessions`, additif). Le serveur les contrôle (période, destinataires de la demande, fiches visibles de l’espace), puis `plannerRebaseOnDrafts` (`packages/domain/src/planner-rebase.ts`) en fait la séance gardée : chaque exercice retrouve par sa référence ce que le planificateur savait de lui (terme dit, mouvement cité, doute) ; une fiche que le coach a changée n’est plus un doute ; un exercice ajouté à la main devient un mouvement du coach, sous le nom de sa fiche. Le modèle modifie donc ce que le coach voit, retouches comprises. Sans `sessions` (versions de l’app d’avant le lot P5, anciens clients), l’ajustement repart de la séance gardée, comme avant. Le même envoi accompagne le retrait d’un emplacement, qui déplace le reste de la séance. Limite : les charges adaptées par athlète ne survivent pas à un ajustement, la séance étant réécrite.

## Accès

- Une clé OpenAI sur le serveur, sauf `AI_PLANNER_ENABLED=false` qui coupe tout.
- Drapeau de l'espace (`ai_planner_enabled`), offre différente de Découverte, droit `manageSessions`.
- Accord explicite de l'utilisateur, nommant OpenAI et les États-Unis, retirable (`profiles.ai_consent_at`). Exigé par le serveur avant tout appel, et par la règle Apple 5.1.2(i).
- Coupe-circuit : `/admin` → Couper l'IA partout.

## Quotas et limites

| Offre         | Propositions par mois | Dictée par mois |
| ------------- | --------------------: | --------------: |
| Pilote, Coach |                    30 |          60 min |
| Club          |                   150 |         300 min |
| Découverte    |                     0 |               0 |

Audio : 3 Mio et 180 secondes au plus. Pas de dépassement payant. Règle pure : `packages/domain/src/ai-planner.ts`.

## Données

Envoyés à OpenAI : le texte de la demande ; à l’étape « Retrouver », la bibliothèque de l’espace (clé, nom, alias, famille, matériel de chaque fiche, sans guide ni note) ; à l’étape « Composer », les fiches utiles et le contexte structuré décrit plus haut ; l’audio d’une dictée. Les noms des groupes et des athlètes sont remplacés par des jetons à toutes les étapes, mais un texte libre peut en contenir d’autres, d’où la consigne de ne citer ni athlète ni donnée de santé. Les termes appris d’un espace ne partent que dans les demandes de cet espace.

Conservation : transcription 24 h ; proposition abandonnée sept jours ; après création des brouillons, le plus tôt entre 24 h après conversion et sept jours après création. Tartan ne conserve pas l’audio. `store:false` ne garantit pas une rétention nulle chez OpenAI : c’est une question du dossier juridique.

## Modèles

Lu le 21 novembre 2026 dans la documentation d’OpenAI : pages « Models », « Deprecations », « Pricing », et guides « Latest model », « Reasoning », « Structured Outputs », « Prompt caching » (`platform.openai.com/docs`). `gpt-4.1` et `gpt-4.1-mini`, utilisés jusqu’au lot H, sont dépréciés et s’arrêtent le 14 janvier 2027.

| Étape                                          | Variable du modèle           | Défaut           | Effort de raisonnement                                     | Délai |
| ---------------------------------------------- | ---------------------------- | ---------------- | ---------------------------------------------------------- | ----- |
| Comprendre                                     | `AI_PLANNER_FAST_MODEL`      | `gpt-6.1-terra`  | `AI_PLANNER_UNDERSTAND_EFFORT`, défaut `none`              | 25 s  |
| Retrouver                                      | `AI_PLANNER_FAST_MODEL`      | `gpt-6.1-terra`  | `AI_PLANNER_MATCH_EFFORT`, défaut `low`                    | 25 s  |
| Composer, demande seulement décrite            | `AI_PLANNER_DESCRIBED_MODEL` | le modèle rapide | `AI_PLANNER_COMPOSE_EFFORT`, défaut `none`                 | 70 s  |
| Composer, une partie à proposer, ou ajustement | `AI_PLANNER_MODEL`           | `gpt-6.2-sol`    | `AI_PLANNER_COMPOSE_EFFORT` (`none` devient `low` sur Sol) | 70 s  |
| Réparer                                        | `AI_PLANNER_MODEL`           | `gpt-6.2-sol`    | `AI_PLANNER_REPAIR_EFFORT`, défaut `low`                   | 45 s  |

**Modèle par nature de demande** (depuis le 22 novembre 2026). Une demande seulement décrite (nature `described`, aucune partie à proposer, pas un ajustement) n’est qu’une mise en forme fidèle : elle se compose avec le modèle rapide. Dès qu’une partie est à proposer (`objective`, `mixed`), ou pour un ajustement, qui réécrit une séance déjà composée, propositions comprises, c’est le modèle principal. La réparation reste au principal. Le choix vit dans `plannerStepSettings` et `plannerOnlyDescribed` (`provider.ts`). `AI_PLANNER_DESCRIBED_MODEL` vide vaut le modèle rapide ; le poser à la valeur de `AI_PLANNER_MODEL` rend la composition au principal pour toute demande.

Tous les réglages sont dans `apps/web/src/lib/env.ts`. **Une variable `AI_PLANNER_MODEL` posée sur Vercel l’emporte sur le défaut : si elle vaut encore `gpt-4.1`, il faut la retirer ou la mettre à jour.**

Chaque appel passe par l’API Responses : sortie stricte (`text.format`, schéma JSON), `store: false`, consignes en messages `developer`, demande du coach en message `user`. Particularités lues dans la documentation et vérifiées par appel réel :

- Les modèles GPT-6 n’acceptent pas `temperature` : seul `reasoning.effort` règle l’appel. Sol et Astra refusent `none`, que l’adaptateur remplace par `low` ; Luna et Terra l’acceptent.
- Depuis GPT-5.6, une écriture en cache se paie 1,25 fois le prix d’entrée. L’adaptateur demande un cache explicite et pose son repère à la fin de la partie stable (consignes, puis bibliothèque) : la demande du coach, qui ne se relit jamais, n’est pas écrite en cache.
- Le schéma de « Composer » cite la prescription par référence (`$defs`) : environ 6 700 caractères au lieu de 20 000.
- **Un schéma fixe par étape** (depuis le 22 novembre 2026). Un schéma qui change d’une demande à l’autre (liste de dates, de jetons de fiches) sort l’entrée du cache du fournisseur : « Composer » ne lisait aucun jeton en cache. Les schémas ne portent plus rien de la demande ; ce qu’ils bornaient est vérifié par règles (date dans la période, destinataire connu, fiche donnée au modèle). Mesuré : le coût de « Composer » baisse de moitié, sa latence ne change pas.

Prix au million de jetons (tarif Standard) : `gpt-6.2-sol` 2 $ en entrée, 10 $ en sortie ; `gpt-6.1-terra` 1 $ et 5 $ ; `gpt-6-luna` 0,10 $ et 0,50 $ ; `gpt-6.2-astra` 8 $ et 40 $. Ils sont écrits à un seul endroit, `apps/web/evals/e2e/prices.ts`, à relire avant chaque mesure réelle.

### Comparaison du 21 novembre 2026

Jeu de développement (20 cas, 30 paires), appels réels, deux demandes simultanées. Ce jeu **ne qualifie rien** : voir « Isolement du corpus » plus bas.

| Principal       | Rapide          | Cas justes, par passage | Séance complète, médiane | 95e centile | Coût par demande |
| --------------- | --------------- | ----------------------- | ------------------------ | ----------- | ---------------: |
| `gpt-6.2-sol`   | `gpt-6.1-terra` | 20, 20, 20 sur 20       | 8,7 à 9,4 s              | 16 s        |         0,0146 $ |
| `gpt-6.2-sol`   | `gpt-6-luna`    | 19 sur 20               | 8,3 s                    | 15 s        |         0,0135 $ |
| `gpt-6.1-terra` | `gpt-6.1-terra` | 20, 20, 20 sur 20       | 6,8 à 7,5 s              | 12 à 13 s   |         0,0069 $ |
| `gpt-6.1-terra` | `gpt-6-luna`    | 20, 20 sur 20           | 5,9 à 6,0 s              | 12,5 s      |         0,0055 $ |

Le cas manqué avec Sol et Luna (un squat proposé en échauffement alors qu’il était déjà cité) venait de l’étape « Composer » ; il a été corrigé par une règle de domaine avant les passages suivants.

Paires, par l’étape « Retrouver » seule, deux passages par modèle : `gpt-6.1-terra` 30 sur 30 deux fois, 1,3 à 1,5 s par terme, 0,0005 $ ; `gpt-6-luna` 30 sur 30 deux fois, 1,0 à 1,2 s, 0,0001 $.

Latence par étape, médianes : premier résumé lisible 0,9 à 1,2 s ; comprendre 2,6 s avec Terra, 1,8 s avec Luna ; retrouver 0 s quand les règles suffisent (17 demandes sur 20), 1,3 s sinon ; composer 5,5 s avec Sol, 3,8 s avec Terra. Aucune réparation n’a été nécessaire sur ce jeu.

Jetons par demande, Sol et Terra : 6 900 en entrée et 600 en sortie en moyenne, contre 16 000 par appel avant la refonte. Par appel : comprendre 2 650 en entrée et 150 en sortie ; retrouver 4 800 et 85 (catalogue commun entier, seulement quand les règles ne suffisent pas) ; composer 4 200 et 520.

**Défauts retenus, et pourquoi.** Les quatre couples font le même score sur ce jeu, qui a été écrit par l’agent qui a écrit le planificateur : il ne départage pas les modèles. Le choix reste donc prudent. Rapide : `gpt-6.1-terra`, parce qu’une erreur de date ou de destinataire à l’étape 1 est une faute grave et que l’écart de coût avec Luna est de 0,001 $ par demande. Principal : `gpt-6.2-sol`, parce que la qualité d’entraînement d’une séance proposée n’est mesurée par aucun jeu et que la demande coûte déjà deux fois moins qu’avec `gpt-4.1` (0,033 $). `gpt-6.1-terra` en principal est l’option économe (moitié du coût, 1,5 s de moins) : elle se décide sur le corpus gelé, avec `--model gpt-6.1-terra`.

### Second tour, 22 novembre 2026

La première mesure sur le corpus gelé (Sol et Terra, trois passages) n’a pas tenu les seuils : 59, 59 et 56 cas justes sur 80, 132 à 134 paires sur 150, 3 à 4 fiches choisies à tort sur 21 termes absents, médiane 13,5 s. Les causes ont été rendues par catégorie, sans aucune consigne du corpus, puis reproduites dans le jeu de développement, étendu à 33 cas et 66 paires. Avant correction, sur les 13 cas et 36 paires ajoutés : 5 cas justes, 31 paires, une fiche choisie à tort sur 11 termes absents.

| Principal                      | Rapide          | Cas justes sur 33 | Paires sur 66 | Fiche à tort, sur 16 absents | Médiane complète | « Composer » | Coût par demande |
| ------------------------------ | --------------- | ----------------- | ------------- | ---------------------------- | ---------------- | ------------ | ---------------: |
| `gpt-6.2-sol`                  | `gpt-6.1-terra` | 33, 33            | 66, 66        | 0, 0                         | 9,4 à 9,5 s      | 6,1 s        |          0,009 $ |
| `gpt-6.1-terra`, effort `low`  | `gpt-6.1-terra` | 32                | non rejouées  | non rejouées                 | 7,8 s            | 4,0 s        |          0,004 $ |
| `gpt-6.1-terra`, effort `none` | `gpt-6.1-terra` | 33                | non rejouées  | non rejouées                 | 7,4 s            | 4,0 s        |          0,004 $ |

Ce jeu reste celui de l’auteur : il dit que les catégories signalées sont corrigées ici, pas que le corpus gelé passera.

**Latence de « Composer ».** Elle suit le volume écrit : environ 1 s, plus 12 ms par jeton de sortie. Sol écrit 540 jetons par séance, raisonnement compris ; Terra 350, avec ou sans effort. Le schéma fixe a divisé par deux le coût de l’étape (0,016 $ à 0,007 $ par appel avec Sol) sans changer sa durée. Raccourcir les raisons et les hypothèses d’une séance proposée n’a rien gagné de mesurable. Le seul levier qui reste est le modèle : Terra en principal gagne 2 s par demande et coûte moitié moins. Les défauts ne changent pas tant que le corpus gelé n’a pas dit si la justesse tient.

### Troisième tour, 22 novembre 2026

Sur le corpus gelé, le second tour donnait 74 cas justes sur 80 (seuil 76), 147 paires sur 150, une fiche choisie à tort sur 21 termes absents et une faute grave dans deux passages sur trois. Quatre causes restaient, rendues par catégorie et reproduites dans le jeu de développement (38 cas, 74 paires) :

1. **Confiance mal calibrée à l’étape « Retrouver ».** Une équivalence que seule la connaissance du modèle portait était rendue `sure`, sans marque ; un terme qui ne différait de sa fiche que par un matériel ou un synonyme était rendu `absent`. Corrigé par la relation dite par le modèle et le verdict par règle (section « 2. Retrouver »).
2. **Mouvement annoncé par son nombre**, lu comme la suite de la prescription précédente. Corrigé par la consigne et par une règle de complétude (section « 1. Comprendre »).
3. **Nombres en lettres** dans une charge dictée : 70 et 80 kg vidés. Corrigé par une lecture grammaticale (section « 4. Contrôler »).
4. **Latence et coût de « Composer ».** Une demande seulement décrite se compose désormais avec le modèle rapide (section « Modèles »).

Jeu de développement, appels réels, deux passages, sur le code final : 38 cas sur 38 deux fois, 74 paires sur 74 deux fois, aucune fiche choisie à tort sur 19 absents, aucune faute grave, aucune question inutile. Séance complète en 7,4 à 7,5 s de médiane (95e centile 14 à 17 s) ; « Composer » 4,1 à 4,3 s. Coût moyen d’une demande : 0,0051 $, contre 0,009 $ au second tour avec Sol pour toutes les compositions. 31 compositions sur 35 sont parties au modèle rapide, 4 (objectifs et demandes mixtes) au principal. Ce jeu reste celui de l’auteur : il ne dit pas que le corpus gelé passera.

`gpt-transcribe` sert la dictée (`AI_TRANSCRIPTION_MODEL`) depuis le 12 novembre 2026, à la place de `gpt-4o-mini-transcribe`, arrêté par OpenAI le 26 février 2027. Il reçoit la langue dans `languages[]`, le vocabulaire dans `keywords[]` (termes appris, fiches de l’espace, fiches communes, 48 au plus) et un contexte court dans `prompt`. Prix annoncé : 0,0045 $ la minute. Non éprouvé sur une vraie dictée.

## Essais avec le prestataire simulé

`AI_PLANNER_FAKE_PROVIDER=true` remplace OpenAI par `src/server/ai/fake-provider.ts`, qui simule **chaque étape** à partir du contexte reçu et passe par les mêmes contrôles que le vrai. Ce réglage est sans effet sur Vercel et refusé en production par `assertEnvIsolation`. Il suit le contexte : fiche nommée dans la consigne, « 80 % » lu comme un pourcentage du maximum, toujours 3 séries de 8 et 90 s de repos. Un terme dont deux fiches portent tous les mots donne une fiche `probable` ; un terme qu’aucune fiche ne porte en entier, un emplacement à compléter. Un ajustement modifie la séance reçue : chaque exercice hors circuit passe à quatre séries, le reste ne bouge pas. « #panne-saturated » simule une panne à la première étape, « #panne-compose-timeout » à l’étape nommée.

- Le job `maestro` de la CI mobile joue le planificateur de l’app native contre un serveur local réglé ainsi, sur iOS et Android : `coach-planner.yml` (demande en un écran, séance relue, brouillon créé) et `coach-planner-resolution.yml` (un mouvement au nom neuf devient un emplacement, complété par une création rapide, puis le brouillon). L’app déclare `slots` et `checks`, comme le web.
- Le parcours web `e2e/ai-planner.spec.ts` s’exerce contre ce même prestataire (`E2E_AI_PLANNER_ENABLED=true`), sur ordinateur et sur téléphone : demande en un champ et un clic, au clavier ; compréhension affichée ; fiche rapprochée changée en un geste, terme retenu à la demande suivante, puis retiré de « Mes termes » ; emplacement rempli par une création en deux gestes, par une fiche de la bibliothèque, ou retiré ; brouillon refusé tant qu’un emplacement reste ; remplacement par une fiche hors de la proposition ; ajustement qui garde une retouche manuelle ; aperçu des charges qui reste ouvert ; dictée par le bouton du champ (seule la transcription est simulée) ; objectif seul avec précisions ; panne lisible ; `% 1RM` retiré puis gardé selon la couverture des références ; accès depuis une nouvelle séance, le calendrier et les premiers pas. Avec `E2E_SHOTS_DIR`, il range ses captures à 390, 768 et 1440 px hors du dépôt.

Un test qui simule le prestataire ne prouve pas le prestataire : la preuve réelle est la mesure de bout en bout.

## Déploiement

Migrer avant de déployer le code : `20261121120000_exercise_term_aliases` crée la table des termes appris et ajoute `ai_planner_operations.failure_step`, sans rien retirer. Le cron lit les tables IA même coupées. En retour arrière, conserver les tables.

## Mesure de bout en bout

C’est la mesure qui compte depuis les quatre étapes. Elle part de la consigne et s’arrête aux brouillons préparés, par le vrai service.

```sh
corepack pnpm --filter @tartan/web eval:planner:e2e --check      # format et gel, sans base ni réseau
corepack pnpm --filter @tartan/web eval:planner:e2e --freeze     # écrit l'empreinte du corpus et des paires
corepack pnpm --filter @tartan/web eval:planner:e2e --catalog    # le catalogue commun et les fiches de départ d'un espace neuf
AI_PLANNER_FAKE_PROVIDER=true corepack pnpm --filter @tartan/web eval:planner:e2e --examples    # éprouver l'outil, sans appel
corepack pnpm --filter @tartan/web eval:planner:e2e --dev --max-cost 1                          # mise au point, ne qualifie pas
corepack pnpm --filter @tartan/web eval:planner:e2e --max-cost 10                               # la mesure réelle
corepack pnpm --filter @tartan/web eval:planner:e2e --summary .local/planner-e2e-….json         # relire un rapport
```

Options : `--runs 3` (défaut), `--model` (principal), `--fast-model` (rapide), `--only <ids>`, `--suite all|cases|pairs`, `--concurrency 3`, `--max-cost <dollars>`, `--output`, `--corpus`, `--pairs`, `--database-url`, `--examples`, `--dev`. La base est jetable, locale, et son nom finit par `_eval` (`EVAL_DATABASE_URL`, défaut `tartan_planner_e2e_eval` sur le port 54329, à créer avec `createdb`). Le lanceur y applique les migrations sans rien effacer.

**Prestataire.** Sans clé OpenAI, ou avec `AI_PLANNER_FAKE_PROVIDER=true`, le prestataire est simulé : rien ne sort du poste, et tout appel vers OpenAI est refusé. Avec une clé (environnement ou `.env.local`), la mesure est réelle et exige `--max-cost` : elle s’arrête net dès que le coût cumulé le dépasse, ou dès qu’un modèle appelé n’a pas de prix dans `apps/web/evals/e2e/prices.ts`.

**Ce qu’il fait.** Pour chaque cas, il crée un espace (coach avec accord IA, groupes, athlètes fictifs, catalogue commun par `ensureExerciseCatalog`, fiches privées du cas), appelle `createPlannerProposal` avec la date du jour simulée, **sans mode ni brief**, en déclarant `accepts: ["slots", "checks"]`, écoute les événements diffusés, puis `preparePlannerDrafts`. Une paire passe par l’étape « Retrouver » seule (`matchPlannerTerms`), un terme par appel, dans un espace partagé par bibliothèque. Les attentes n’atteignent jamais le service. Le rapport JSON et son résumé lisible vont dans `.local/`, hors Git ; chaque ligne est gardée aussitôt dans un fichier `.lignes.jsonl`. Seul `apps/web/evals/e2e/driver.ts` touche au service.

**Format.** Un cas porte la consigne (`spoken` pour le style dicté), la date du jour simulée, les destinataires, la bibliothèque, et des attentes par propriétés : nature, mouvements attendus avec leur prescription et leur structure, ou bornes d’un objectif, `mustNotAsk` ou `mustAsk` avec son motif, et les fautes graves. Le jeu de paires associe un terme dit à une fiche, ou à `absent`. Le mode d’emploi, avec six exemples, est dans `apps/web/evals/e2e/README.md` ; les schémas dans `format.ts` et `pairs/format.ts`.

**Seuils**, écrits dans `apps/web/evals/e2e/thresholds.ts` avant toute réponse du nouveau planificateur, et appliqués à chacun des trois passages. Le lanceur sort en code 1 si un seul n’est pas tenu.

| Critère                                                                                | Seuil         |
| -------------------------------------------------------------------------------------- | ------------- |
| Fautes graves (date fausse, charge inventée, exercice ajouté, remplacement silencieux) | Aucune        |
| Cas justes                                                                             | 95 % au moins |
| Questions inutiles, sur les cas `mustNotAsk`                                           | 2 % au plus   |
| Paires justes en premier choix                                                         | 97 % au moins |
| Fiche choisie pour un terme `absent`                                                   | 1 % au plus   |
| Premier événement diffusé, médiane                                                     | Sous 2 s      |
| Séance complète, brouillons préparés, médiane                                          | Sous 15 s     |

Seule une mesure complète qualifie (`passed`) : tout le corpus gelé, toutes les paires, trois passages, sur le vrai fournisseur. Une mesure partielle (`--only`, `--suite`, moins de trois passages), les exemples, le jeu de développement et le prestataire simulé ne qualifient rien, même seuils tenus.

### Isolement du corpus

Trois jeux, trois rôles. Ils ne se mélangent jamais.

| Jeu           | Fichiers                                                     | Écrit par                                                                                  | Sert à                                                                              |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Exemples      | `corpus/examples.json`, `pairs/examples.json`                | l’auteur de l’outil                                                                        | Montrer le format et tester l’outil.                                                |
| Développement | `dev/cases.json` (38 cas), `dev/pairs.json` (74 paires)      | l’agent qui écrit le planificateur                                                         | Mettre au point : voir un écart, corriger, relancer. Non gelé. **Ne qualifie pas.** |
| Corpus gelé   | `corpus/cases.json`, `pairs/pairs.json`, avec leur empreinte | un agent isolé, qui n’a lu ni le code, ni les consignes du modèle, ni les deux autres jeux | Qualifier, et rien d’autre.                                                         |

- **Celui qui écrit ou règle le planificateur ne lit jamais le corpus gelé.** Il n’est pas sur sa branche, il ne le cherche pas ailleurs, et il ne lit pas les lignes d’un rapport qui en reprennent les consignes. Il reçoit des comptes : cas justes, questions inutiles, fautes graves, latences, coût.
- Les attentes s’écrivent avant toute exécution et ne changent plus. `--freeze` écrit l’empreinte sha256 à côté de chaque fichier ; le lanceur refuse un fichier sans empreinte ou modifié depuis. Regeler un fichier modifié est refusé aussi : on retire l’empreinte à la main, en le disant.
- Un échec se corrige dans le planificateur, jamais dans le corpus.
- Dès qu’une réponse du corpus gelé a été lue pour régler le planificateur, ce corpus devient une régression : il faut le dire dans le rapport et en écrire un autre pour qualifier.

**La fiche du coach l’emporte.** Quand la fiche choisie n’a pas de clé de catalogue (fiche du coach, fiche de départ) et que son nom ou un alias, normalisé comme le fait l’étape « Retrouver », est exactement le terme dit, le choix est juste, pour un cas comme pour une paire, quelle que soit la fiche attendue (`ownExact` dans `observation.ts`). `--catalog` liste ces fiches à part du catalogue commun. Chaque ligne d’un rapport garde aussi ce qui a été compris (`understood` : terme, prescription dite, confiance, fiche), pour relire un échec sans rejouer.

**Ce que l’outil mesure.** La justesse de la séance préparée, cas par cas ; les questions inutiles ; les fautes graves ; la recherche de fiches (premier choix, trois propositions, faux positifs) ; la latence du premier événement, du premier résumé lisible (`firstSummaryMs`), de la première ligne du plan et du résultat complet, et la durée de chaque étape ; les appels et les jetons d’entrée, lus en cache, écrits en cache et de sortie, par étape et par modèle ; le coût. Il compte les appels en observant `fetch` et rattache chacun à la dernière étape diffusée.

**Ce qu’il ne mesure pas.** La dictée : `spoken` marque le style d’une consigne, aucun son n’est transcrit. L’écran, la route HTTP et sa validation. La création des brouillons (`confirmPlannerProposal`), la publication et la lecture par l’athlète. Les ajustements, les réponses aux questions et le remplissage d’un emplacement. Le remplacement en autonomie. L’ancienne forme servie aux clients sans `slots`. La qualité d’entraînement d’une séance proposée, qui reste une relecture de coach : les bornes disent seulement qu’elle tient dans le cadre demandé.

**Limites écrites dans chaque rapport** (`pipelineLimits`). Le contrat demande encore une période : l’outil donne les 28 jours à partir de la date du jour simulée ; une date citée au-delà devient une question. Le premier événement diffusé est l’ouverture de l’étape « Comprendre », avant tout appel au modèle : ce seuil mesure un accusé de réception, le premier contenu lisible est le résumé. Seuls les athlètes du premier groupe de chaque espace jetable ont une référence de force, sur quatre fiches : un pourcentage proposé n’est permis que pour ce groupe seul. Une paire est mesurée terme par terme : une consigne entière peut retrouver autrement un terme que son contexte éclaire.

## Mesures d’avant les quatre étapes

Les sections qui suivent, jusqu’au corpus du fondateur, décrivent des jeux et des chiffres obtenus avec l’ancien appel unique (`gpt-4.1`, `gpt-4.1-mini`). Leurs scripts tournent encore : ils passent désormais par les quatre étapes (`interpretPlannerContext`) avec un contexte fabriqué, sans le service. Ils n’ont pas été rejoués en réel depuis la refonte : leurs chiffres restent ceux de l’ancien planificateur et ne disent rien du nouveau.

## Évaluer

Corpus versionné : `apps/web/evals/planner-corpus.ts`, 60 consignes fictives, dont 30 propositions attendues et 30 ambiguïtés. Les 30 premières servent aussi de scripts à enregistrer : elles ne sont pas des dictées humaines tant que les enregistrements n'existent pas.

```sh
corepack pnpm --filter @tartan/web eval:planner
corepack pnpm --filter @tartan/web eval:planner --live --ids P01,P03,C01 --output .local/planner-eval-reference.json
corepack pnpm --filter @tartan/web eval:planner --live --resume .local/planner-eval-reference.json
```

La première commande n'appelle pas le réseau. Un rapport contient commit, empreintes, modèle, latences, réponses fictives et différences. Pour mesurer une nouvelle version, crée un autre rapport. N'ajuste jamais les attendus après avoir vu les réponses. N'alimente jamais le corpus avec de vraies données d'athlètes.

**Seuils :** au moins 57/60, 0 date fausse, 0 charge inventée.

| Passage du 9 novembre 2026      | Réussis | Dates fausses | Charges inventées |
| ------------------------------- | ------: | ------------: | ----------------: |
| Base                            |   48/60 |    Non mesuré |        Non mesuré |
| Final, garde-fous déterministes |   59/60 |             0 |                 0 |

**Limites de ce chiffre.** Les contrôles ont été écrits en regardant les échecs de ce corpus : il n'est plus un jeu indépendant. Le modèle reste variable d'un passage à l'autre, même à température 0 : un rejeu a produit 58/60 et une charge inventée, d'où un contrôle déterministe ajouté. Seize cas supplémentaires, écrits avant de voir les réponses, donnent 13/16, sans date fausse ni charge inventée. Échec restant : C22, athlète hors périmètre, où le coach reçoit une erreur au lieu d'une question.

Le rapport reste `betaQualified: false` tant que 30 enregistrements, essais de bruit sur appareils, revue humaine et corrections réelles de coachs ne sont pas documentés (A12).

## Qualification des nouveaux parcours

Le corpus historique de 60 cas reste une régression. Le corpus `apps/web/evals/independent/planner-80.json` contient 80 cas figés et une empreinte vérifiée avant chaque exécution. Il couvre les deux modes, les exercices inconnus, les circuits et les ambiguïtés. Seules la consigne et les données de contexte sont envoyées au modèle ; les attendus servent uniquement à la notation.

```sh
corepack pnpm --filter @tartan/web eval:planner:independent
corepack pnpm --filter @tartan/web eval:planner:independent --live --output .local/planner-independent-reference.json
corepack pnpm --filter @tartan/web eval:planner:independent --live --resume .local/planner-independent-reference.json
```

Pour relire un rapport sans refaire un appel : `eval:planner:independent --summary .local/rapport.json` donne, par passage, les réussites, les questions posées à tort, la latence médiane et au 95e centile, les appels et les jetons ; `--price-in` et `--price-out` (prix par million de jetons) y ajoutent le coût. Un rapport d'avant le 17 novembre 2026 n'a pas de jetons : aucun coût n'est alors affiché.

Sans `--live`, aucun appel externe. Par défaut, trois passages avec au plus trois cas simultanés. La reprise exige les mêmes empreintes de corpus, d’implémentation et de modèle. Le rapport local contient réponses synthétiques, écarts, durées et nombre d’appels. Aucun compte ni donnée d’athlète réel n’est utilisé. Pour corriger une erreur de notation sans refaire les appels, `--rescore .local/source.json --output .local/nouveau.json` garde le rapport original et indique l’empreinte du correcteur.

Seuil attendu : au moins 76/80 à chacun des trois passages, aucune date fausse, charge inventée ou substitution silencieuse acceptée. Un défaut de structure ou de quantité reste un échec même lorsqu’il ne constitue pas une substitution. Après observation des réponses et réglage, ce corpus devient lui aussi une régression : sa provenance reste indiquée, sans le présenter comme un nouveau jeu indépendant.

Une réussite automatique ne clôt pas la qualification : 30 dictées humaines sur appareils, des essais bruités et la relecture des propositions par des coachs restent nécessaires. La génération de propositions est évaluée avec un catalogue synthétique au niveau prestataire ; cela ne prouve ni la validation éditoriale des fiches ni tout le parcours applicatif.

## Mesures du lot H (18 novembre 2026)

Appels réels, corpus de 80 cas devenu régression (il a été lu par des agents, et les contrôles ont été réglés en regardant ses échecs). Rapports hors dépôt, dans `.local/` du worktree du lot, relus par `--summary`.

| Passage                 | Modèle       | Réussis sur 80 | Défaut critique              | Latence médiane |       Coût |
| ----------------------- | ------------ | -------------- | ---------------------------- | --------------- | ---------: |
| Départ (17 novembre)    | gpt-4.1-mini | 66, 61, 68     | aucun                        | 5,0 s           | non compté |
| Après les étapes 1 et 2 | gpt-4.1-mini | 61, 62, 62     | 2 par passage (F5-48, F5-49) | 6,6 à 7,9 s     |     1,65 $ |
| Après l'étape 3         | gpt-4.1-mini | 72, 71, 70     | F5-19 deux fois              | 6,1 à 7,8 s     |     1,70 $ |
| Final                   | gpt-4.1-mini | 70, 69, 70     | aucun                        | 6,7 à 8,5 s     |     1,74 $ |
| Final, un passage       | gpt-4.1      | 75             | aucun                        | 2,7 s           |     2,48 $ |

Le seuil de 76 n'est atteint par aucun passage. Les échecs restants portent sur la profondeur d'un groupe (F5-33, F5-37), un destinataire absent de la sélection nommé dans le texte (F5-45), une demande hors mise en forme (F5-50), deux fiches voisines (F5-19, F5-20, F5-40) et une unité de charge (F5-43).

**Jeu neuf de 20 cas** (`apps/web/evals/independent/planner-20-lot-h.json`, figé par empreinte avant la réécriture du prompt et avant toute réponse ; `--corpus lot-h`) : séries détaillées, autonomie, ajustement, contexte. Un seul passage, `gpt-4.1-mini` : **12 sur 20**, une charge inventée (H-05, montée « jusqu'à 60 kg » écrite en cinq séries à 60 kg). Le premier rapport compte 11 : le corpus nommait des familles d'exercices en mots courants (« running », « plyometrics ») au lieu des clés du catalogue ; la correspondance a été ajoutée au correcteur, le rapport d'origine conservé, le rapport recalculé est à part. Les échecs ont ensuite été corrigés (tournures d'autonomie lues comme des noms inconnus, pyramides, deux lignes d'un même exercice, ajustement du mode « Proposer ») : ce jeu n'est donc plus indépendant non plus.

## Corpus du fondateur (lot 6)

Le dernier jeu indépendant : **40 consignes écrites et 30 dictées** par le fondateur ou un coach, jamais vues par l'agent. Il vit hors du dépôt, dans `.local/planner-founder/`, et n'y entre jamais : seules les consignes fictives y sont admises, sans nom ni résultat d'athlète réel.

| Fichier                 | Contenu                                                                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `consignes.json`        | 40 cas `C01` à `C40`, au format du corpus de 80 cas : `mode` (`format` ou `propose`), `text`, `brief` pour « Proposer », `expected`                                        |
| `dictees/manifest.json` | 30 cas `D01` à `D30` : `file` (m4a, webm ou wav, 3 Mo et 3 minutes au plus), `spoken` (ce que le coach a voulu dire), `setting` (calme, extérieur, vestiaire…), `expected` |
| `dictees/D01.m4a` …     | Les enregistrements, faits sur un téléphone, dont au moins dix dans le bruit                                                                                               |

Modèle de format, à copier puis compléter : `apps/web/evals/founder/modele/`. Les champs de `expected` sont ceux du corpus de 80 cas (`apps/web/evals/planner-independent.ts`) : `status`, `date`, `exercise` (clé du catalogue), `sets`, `reps`, `loadKg`, `restS`, `field` pour une question attendue, `unknownName` pour un exercice absent, `order` pour un circuit. **Les attendus s'écrivent avant toute exécution, et ne changent plus ensuite.**

```sh
corepack pnpm --filter @tartan/web eval:planner:founder            # contrôle, sans réseau
corepack pnpm --filter @tartan/web eval:planner:founder --freeze   # fige le corpus, une seule fois
corepack pnpm --filter @tartan/web eval:planner:founder --live --confirm-cost --output .local/planner-founder-1.json
```

Le contrôle n'affiche que des comptes, des empreintes et des problèmes nommés par identifiant, jamais une consigne : l'agent peut aider à corriger le format sans lire le contenu. `--freeze` écrit l'empreinte des consignes et celle des dictées (manifeste et fichiers audio) ; toute modification ultérieure est refusée. `--live` exige le corpus figé, la clé OpenAI locale (plafond de dépense posé) et `--confirm-cost` : trois passages des 40 consignes, puis une passe des 30 dictées (transcription, puis la même notation que l'écrit, avec l'écart mot à mot entre ce qui a été dit et ce qui a été transcrit). Coût estimé : environ 150 appels au modèle et 30 transcriptions.

**Critères, écrits le 16 novembre 2026 avant toute réponse** (`FOUNDER_THRESHOLDS` dans `apps/web/evals/planner-founder.ts`) :

| Critère                                                 | Seuil                                                                                  |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Consignes écrites réussies, à chacun des trois passages | 38 sur 40 au moins                                                                     |
| Dictées réussies                                        | 27 sur 30 au moins                                                                     |
| Écart de transcription médian (mots)                    | 10 % au plus                                                                           |
| Date fausse, charge inventée, substitution silencieuse  | Aucune, sur tous les passages                                                          |
| Relecture humaine                                       | Les propositions du mode « Proposer » relues par un coach, avec ses corrections notées |

Atteindre ces seuils qualifie le planificateur pour la bêta (`betaQualified`), pas pour l'ouverture : la relecture d'un coach et les essais sur appareils restent des preuves distinctes. Un échec ne se corrige pas en touchant le corpus : on corrige le planificateur, puis on mesure de nouveau avec un autre fichier de rapport. Après ce passage, le corpus devient une régression.

## Reprises et coût

Une demande consomme une proposition du quota de l’espace, compté par mois et partagé entre ses coachs, quel que soit le nombre d’appels au modèle. Une demande ordinaire fait deux ou trois appels : comprendre, retrouver quand les règles ne suffisent pas, composer. S’y ajoutent au plus deux réparations, et deux rejeux par appel en cas de saturation. Toutes les étapes partagent le délai de 100 secondes. Tartan supporte le coût des réparations ; une panne ne décompte rien. Une question bloquante ne coûte que l’étape « Comprendre ».

Coût mesuré le 21 novembre 2026 avec les modèles par défaut : 0,015 $ par demande en moyenne sur le jeu de développement, soit 0,44 $ par mois pour un espace qui consomme ses 30 propositions, 2,20 $ pour 150. Les modèles par défaut ne changent qu’après une comparaison documentée ici.

## Recette navigateur avec OpenAI réel

Après autorisation des appels réels, avec la clé déjà disponible dans l’environnement local :

```sh
RUN_PLANNER_LIVE=1 corepack pnpm --filter @tartan/web test:e2e:planner:live
```

Cette recette est distincte de la CI ordinaire et la refuse. Elle reconstruit le serveur sur le port 3104, remet à zéro uniquement la base locale jetable `tartan_e2e` sur 54329, crée un coach et un athlète fictifs, puis exerce clarification, création privée, reprise, brouillon, publication et lecture athlète. Aucun résultat OpenAI ni aucune proposition ne sont injectés. La validation d’adresse e-mail et les droits du compte synthétique sont préparés en base ; la livraison e-mail n’est donc pas prouvée. Ne pas la lancer en parallèle d’un autre parcours utilisant cette base ou le dossier de build web. La clé reste hors du dépôt et des sorties ; aucun paramètre de production n’est modifié.
