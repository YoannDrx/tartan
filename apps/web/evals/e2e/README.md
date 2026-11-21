# Mesure de bout en bout du planificateur : écrire des cas

Ce dossier mesure le planificateur comme un coach le rencontre : une consigne entre, des brouillons de séance sortent. Tu n'as besoin de connaître ni le prompt, ni les contrôles du serveur. Tu écris ce qu'un coach dirait, et ce qu'un coach attendrait en retour.

Les commandes, les seuils et ce que l'outil mesure sont dans [docs/reference/planificateur-ia.md](../../../../docs/reference/planificateur-ia.md), section « Mesure de bout en bout ».

## Les fichiers

| Fichier                                       | Contenu                                                                           |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| `corpus/cases.json`                           | Le corpus : `{ "version": 2, "cases": [...] }`. À écrire, puis à geler.           |
| `pairs/pairs.json`                            | Le jeu de paires : terme dit → fiche attendue. À écrire, puis à geler.            |
| `corpus/examples.json`, `pairs/examples.json` | Les exemples de cette page. Ils servent aux tests de l'outil, jamais à la mesure. |
| `format.ts`, `pairs/format.ts`                | Les schémas. Ils font foi si cette page s'en écarte.                              |

```sh
corepack pnpm --filter @tartan/web eval:planner:e2e --catalog   # les clés du catalogue commun
corepack pnpm --filter @tartan/web eval:planner:e2e --check     # format et gel, sans base ni réseau
corepack pnpm --filter @tartan/web eval:planner:e2e --freeze    # écrit l'empreinte : le corpus ne change plus
```

`--check` n'affiche jamais une consigne : des comptes, des empreintes, et les problèmes par identifiant. Mets le fichier en forme avec Prettier **avant** de geler : un reformatage après coup change l'empreinte.

## Règles d'écriture

- Écris les attentes **avant** toute exécution, et ne les change plus ensuite. Un échec se corrige dans le planificateur.
- Personnes, groupes et charges fictifs. Aucun nom, aucun résultat d'athlète réel, aucune donnée de santé.
- N'écris pas pour faire réussir ou échouer : écris ce qu'un coach dit vraiment, y compris mal.
- Un cas attend des **propriétés**. Ne décris pas ce que la consigne ne dit pas : un champ absent n'est pas contrôlé.

## Un cas

Ce que le planificateur reçoit :

| Champ        | Sens                                                                                                                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | Identifiant unique, lettres, chiffres, tirets.                                                                                                                                                                                               |
| `kind`       | `described` : le coach décrit sa séance. `objective` : il donne un objectif et laisse composer. `mixed` : il décrit une partie et laisse composer le reste.                                                                                  |
| `text`       | La consigne, telle qu'il l'écrit ou la dicte.                                                                                                                                                                                                |
| `spoken`     | `true` pour le style dicté : pas de ponctuation, nombres en lettres, reprises, « euh ».                                                                                                                                                      |
| `today`      | La date du jour simulée. « Demain » et « jeudi » se lisent depuis elle.                                                                                                                                                                      |
| `recipients` | Les groupes et athlètes choisis : `{ "groups": ["Sprint"], "athletes": ["Lina Morel"] }`.                                                                                                                                                    |
| `space`      | Facultatif. Le profil de l'espace : `equipment`, `disciplines`, `objectives`, tous ses `groups` (avec leurs `athletes`) et ses `athletes` hors groupe. Un groupe cité dans `recipients` et absent d'ici est créé avec deux athlètes fictifs. |
| `library`    | `{ "catalog": "common", "private": [...] }` : le catalogue commun de Tartan, plus les fiches privées du cas (`name`, `category`, et au besoin `aliases`, `family`, `movement`, `equipment`, `loadable`).                                     |

Ce qu'on attend, dans `expect`. Cette partie n'atteint jamais le planificateur.

| Champ                      | Sens                                                                                                                                                                                                                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mustNotAsk: true`         | La séance doit arriver sans qu'une question arrête le coach. Un doute peut rester marqué « À vérifier ».                                                                                                                                                                                             |
| `mustAsk: { "reason": … }` | Une question est la seule bonne réponse. Trois motifs seulement : `no_date` (aucune date possible), `no_recipient` (aucun destinataire), `off_topic` (la demande n'est pas une séance). Exactement un de `mustNotAsk` ou `mustAsk`.                                                                  |
| `sessions`                 | Les séances attendues, une par date. Vide pour un cas `mustAsk`.                                                                                                                                                                                                                                     |
| `critical`                 | Les fautes qui seraient graves pour ce cas, parmi `wrong_date` (date fausse), `invented_load` (charge que le coach n'a pas dite), `added_exercise` (exercice ajouté), `wrong_exercise` (une fiche à la place d'une autre, sans marque « À vérifier »). Une faute absente de la liste reste un écart. |

Une séance attendue porte `date`, et selon `kind` :

- `described` : `steps`, la liste ordonnée de ce que le coach a dit.
- `objective` : `bounds`, les bornes de ce qu'il a laissé composer.
- `mixed` : les deux. Les `steps` doivent se retrouver dans cet ordre ; d'autres exercices peuvent s'y ajouter.
- `recipients`, seulement si cette séance ne vise pas tous les destinataires du cas.

### `steps` : un mouvement, une pause, ou des tours

Un mouvement a **une** identité :

- `"key": "back-squat"` : une fiche du catalogue commun (`--catalog` donne les clés). `"accept": [...]` ajoute d'autres clés acceptées, quand deux fiches conviennent vraiment.
- `"private": "Tirage élastique maison"` : une fiche privée déclarée dans `library.private`.
- `"absent": true, "said": "planche Copenhague"` : aucune fiche n'existe. La séance doit garder un **emplacement à compléter** à cette place. Une fiche voisine mise à la place est un écart, et une faute si rien ne la signale.

Et sa prescription : `sets` (séries), `reps` **ou** `durationS` (secondes) **ou** `distanceM`, `restS` (repos entre les séries, en secondes), et `load`. `load` est obligatoire : `{ "value": 60, "unit": "kg" }`, `{ "value": 80, "unit": "pct_1rm" }`, ou `null` quand le coach n'a donné aucune charge. Toute charge qui apparaît sans avoir été dite est une charge inventée. `setPlan` détaille une pyramide, série par série ; `load` est alors la première série de travail.

Une pause explicite entre deux mouvements : `{ "recoveryS": 90 }`.

Des tours, circuit ou superset : `{ "rounds": 3, "restBetweenRoundsS": 60, "steps": [...] }`. `"kind": "circuit"` ou `"superset"` sert à la relecture seulement. Trois tours d'un seul exercice et trois séries se valent.

### `bounds` : ce qu'un objectif laisse libre

`exercises: { "min": 4, "max": 8 }` (obligatoire), `noKg` (obligatoire : `true` si aucun kilo ne doit apparaître), `durationMin: { "max": 40 }`, `equipment` (le matériel permis, `"bodyweight"` pour « sans matériel »), `families` (les familles à couvrir : `strength`, `weightlifting`, `mobility`, `plyometrics`, `running`, `core`, `coordination`, `stairs`, `warmup`).

## Six exemples

Écrits pour montrer le format. Le fichier complet est `corpus/examples.json`.

**EX-01, décrite, écrite.** « Aujourd'hui pour le groupe Sprint : squat arrière, 3 séries de 8, récupération 1 min 30. » Aujourd'hui est le 23 novembre.

```json
{
  "mustNotAsk": true,
  "sessions": [
    { "date": "2026-11-23", "steps": [{ "key": "back-squat", "sets": 3, "reps": 8, "load": null, "restS": 90 }] }
  ],
  "critical": ["wrong_date", "invented_load", "added_exercise", "wrong_exercise"]
}
```

**EX-02, décrite, dictée, circuit et fiche privée.** « alors demain pour les sauteurs on fait un circuit trois tours avec dix fentes sautées vingt secondes de gainage ventral et huit tirages élastique maison une minute entre les tours et après ça développé couché quatre fois six à soixante kilos deux minutes de récup »

```json
{
  "mustNotAsk": true,
  "sessions": [
    {
      "date": "2026-11-24",
      "steps": [
        {
          "kind": "circuit",
          "rounds": 3,
          "restBetweenRoundsS": 60,
          "steps": [
            { "key": "split-jumps", "reps": 10, "load": null },
            { "key": "front-plank", "durationS": 20, "load": null },
            { "private": "Tirage élastique maison", "reps": 8, "load": null }
          ]
        },
        { "key": "bench-press", "sets": 4, "reps": 6, "load": { "value": 60, "unit": "kg" }, "restS": 120 }
      ]
    }
  ],
  "critical": ["wrong_date", "invented_load", "added_exercise", "wrong_exercise"]
}
```

**EX-03, décrite, une fiche qui n'existe pas.** « Mercredi, groupe Demi-fond : planche Copenhague 3 x 20 secondes par côté, puis gainage latéral 3 x 30 secondes, 45 secondes de récupération. » Aucune question ne doit bloquer : la planche Copenhague reste à compléter.

```json
{
  "mustNotAsk": true,
  "sessions": [
    {
      "date": "2026-11-25",
      "steps": [
        { "absent": true, "said": "planche Copenhague", "sets": 3, "durationS": 20, "load": null },
        { "key": "side-plank", "sets": 3, "durationS": 30, "load": null, "restS": 45 }
      ]
    }
  ],
  "critical": ["wrong_date", "invented_load", "added_exercise", "wrong_exercise"]
}
```

**EX-04, objectif.** « Jeudi, séance de renforcement du tronc et de pliométrie légère pour le groupe Sprint, 40 minutes, sans matériel. »

```json
{
  "mustNotAsk": true,
  "sessions": [
    {
      "date": "2026-11-26",
      "bounds": {
        "durationMin": { "max": 40 },
        "equipment": ["bodyweight"],
        "families": ["core", "plyometrics"],
        "exercises": { "min": 4, "max": 8 },
        "noKg": true
      }
    }
  ],
  "critical": ["wrong_date", "invented_load"]
}
```

**EX-05, mixte, dictée, un seul athlète.** « vendredi pour Lina on commence par vingt minutes de footing d'échauffement et ensuite tu me proposes un bloc de mobilité des hanches et des chevilles un quart d'heure pas plus »

```json
{
  "mustNotAsk": true,
  "sessions": [
    {
      "date": "2026-11-27",
      "steps": [{ "key": "warmup-jog", "durationS": 1200, "load": null }],
      "bounds": {
        "durationMin": { "max": 35 },
        "families": ["mobility"],
        "exercises": { "min": 3, "max": 7 },
        "noKg": true
      }
    }
  ],
  "critical": ["wrong_date", "invented_load"]
}
```

**EX-06, une question est attendue.** « Séance de côtes pour le groupe Demi-fond quand la météo le permettra : 8 fois course en côte courte, récupération en descente. » Aucune date ne peut être déduite.

```json
{ "mustAsk": { "reason": "no_date" }, "sessions": [], "critical": ["wrong_date"] }
```

## Le jeu de paires

Il mesure une seule chose : retrouver la bonne fiche à partir de ce que dit le coach. Un fichier, une bibliothèque de référence, des paires :

```json
{
  "version": 2,
  "library": { "catalog": "common", "private": [{ "name": "Tirage élastique maison", "category": "strength" }] },
  "pairs": [
    { "id": "PX-02", "said": "RDL", "key": "romanian-deadlift" },
    { "id": "PX-06", "said": "tirage élastique maison", "private": "Tirage élastique maison" },
    { "id": "PX-07", "said": "planche Copenhague", "absent": true }
  ]
}
```

`said` est le terme tel qu'il est dit : abréviation, anglicisme, faute, nom d'usage. Chaque paire attend une clé du catalogue, une fiche privée de la bibliothèque, ou `absent` quand aucune fiche ne doit être choisie. Trois notes par paire : juste en premier choix, présente dans les trois propositions, fiche choisie à tort pour un terme `absent`.

## Comment un cas est noté

Un cas est **juste** quand aucun écart n'est relevé : mêmes dates, mêmes destinataires, mêmes mouvements dans le même ordre, mêmes valeurs pour chaque champ écrit, mêmes tours, bornes tenues. Une question sur un cas `mustNotAsk` est une **question inutile**. Une faute de la liste `critical` est une **faute grave** : une seule fait échouer la mesure entière.
