# Consignes à donner à un agent

À copier telles quelles dans Codex ou Claude. Chacune suppose que l'agent lit d'abord `AGENTS.md`.

## Reprendre le développement

```text
Lis AGENTS.md, puis docs/ETAT.md et docs/JOURNAL.md. Résume en dix lignes où en est le projet et propose la prochaine tâche d'agent la plus utile, sans rien modifier. Attends mon accord.
```

## Faire un lot

```text
Lis AGENTS.md, docs/ETAT.md et docs/JOURNAL.md. Fais le lot A3 décrit dans docs/plans/web.md, puis arrête-toi. Une branche, une PR. Lance les contrôles d'AGENTS.md, mets à jour docs/ETAT.md et docs/JOURNAL.md, et dis-moi ce qui est codé, testé et éprouvé.
```

Remplace A3 par le lot voulu. Les lots B et J sont dans `docs/plans/direction-artistique.md` ; pour eux, fais lire aussi `DESIGN.md`.

## Écrire les tests critiques

```text
Lis AGENTS.md et docs/tests/automatisation.md. Fais la tâche T01, puis arrête-toi. Une frontière, une PR. Le test doit échouer sans le code et passer avec. Mets à jour docs/ETAT.md et docs/JOURNAL.md. Si le test révèle un bug, corrige-le dans la même PR.
```

Remplace T01 par la tâche suivante à chaque fois. T04 (matrice d'accès) demande d'abord la fondation « personas ».

## Avancer sur la web app

```text
Lis AGENTS.md et docs/plans/web.md. Dresse la liste des étapes marquées Agent qui ne sont pas faites d'après docs/ETAT.md, puis exécute la première. Pour une étape marquée Fondateur, donne-moi la marche à suivre exacte et la commande à lancer, sans la faire à ma place.
```

## Avancer sur iOS

```text
Lis AGENTS.md, docs/plans/ios.md et docs/reference/fiches-stores.md. Fais les étapes I1, I2, I3, chacune dans sa PR. Vérifie sur simulateur. Rien ne doit être soumis à Apple sans mon accord.
```

## Avancer sur Android

```text
Lis AGENTS.md et docs/plans/android.md. Traite le blocage des builds EAS : trouve la cause, corrige, et obtiens un build de production. Aucun envoi sur Google Play sans mon accord.
```

## Préparer la vente

```text
Lis AGENTS.md et docs/plans/commercialisation.md. Vérifie chaque porte d'ouverture avec le code et la production, sans rien modifier, et rends-moi un tableau : franchie, non franchie, preuve. N'ouvre pas les inscriptions.
```

## Clore un travail

```text
Avant de terminer : lance les contrôles d'AGENTS.md, mets à jour docs/ETAT.md, ajoute une entrée à docs/JOURNAL.md, et dis-moi ce qui est codé, testé et éprouvé.
```
