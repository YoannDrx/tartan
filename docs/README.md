# Carte de la documentation

Chaque sujet a un seul document. Si deux documents se contredisent, `ETAT.md` l'emporte sur l'état d'avancement, `AGENTS.md` sur les règles, le code sur le comportement.

## À lire en premier

| Document | Pour savoir |
| --- | --- |
| [../AGENTS.md](../AGENTS.md) | Les règles du dépôt et la méthode de travail |
| [ETAT.md](ETAT.md) | Où on en est, ce qui est prouvé, ce qui reste à faire, qui agit |
| [JOURNAL.md](JOURNAL.md) | Ce que le dernier agent a fait et laissé en suspens |
| [../PRODUCT.md](../PRODUCT.md) | Le produit, les cibles, les décisions |
| [../DESIGN.md](../DESIGN.md) | L'identité visuelle |
| [prompts.md](prompts.md) | Les consignes prêtes à donner à Codex ou à Claude |

## Plans de mise en production

| Document | Contenu |
| --- | --- |
| [plans/web.md](plans/web.md) | Mettre la web app en état de vendre, puis l'ouvrir |
| [plans/ios.md](plans/ios.md) | De l'archive à l'App Store |
| [plans/android.md](plans/android.md) | Du compte Google à Google Play |
| [plans/commercialisation.md](plans/commercialisation.md) | Portes d'ouverture, offres, lancement, premiers clients |
| [plans/stripe.md](plans/stripe.md) | Abonnements, webhooks, sandbox, remboursements, fiscalité |

## Tests

| Document | Contenu |
| --- | --- |
| [tests/README.md](tests/README.md) | Commandes, couverture par fonction, pièges |
| [tests/comptes.md](tests/comptes.md) | Obtenir chaque rôle et chaque offre pour tester |
| [tests/automatisation.md](tests/automatisation.md) | Les tests à écrire, classés par risque, avec critères de fin |
| [tests/recette-reelle.md](tests/recette-reelle.md) | Ce qu'un humain doit éprouver à la main, pas à pas |

## Exploitation

| Document | Contenu |
| --- | --- |
| [exploitation/README.md](exploitation/README.md) | Environnements, variables, déploiement, retour arrière, surveillance |
| [exploitation/sauvegarde.md](exploitation/sauvegarde.md) | Sauvegarde et restauration de la base |
| [exploitation/notifications.md](exploitation/notifications.md) | Livraison des notifications, notes de version |
| [exploitation/captures.md](exploitation/captures.md) | Refaire les captures du site et des stores |

## Référence

| Document | Contenu |
| --- | --- |
| [reference/conformite.md](reference/conformite.md) | Données traitées, sous-traitants, questions juridiques |
| [reference/fiches-stores.md](reference/fiches-stores.md) | Textes et formulaires App Store et Google Play |
| [reference/planificateur-ia.md](reference/planificateur-ia.md) | Fonctionnement, quotas, évaluation du planificateur IA |
| [reference/references-force.md](reference/references-force.md) | Références de force et rapprochement des exercices |
| [reference/prescriptions-figees.md](reference/prescriptions-figees.md) | Gel des prescriptions à la publication |

## Comment garder cette documentation juste

- Un fait d'avancement n'est écrit que dans `ETAT.md`. Les plans décrivent la marche à suivre, pas l'état du jour.
- L'historique d'un lot vit dans Git et les PR, pas dans un fichier de plus.
- Un nouveau document n'est créé que s'il ne trouve pas sa place dans cette carte, et il y est ajouté.
- Le dépôt est public : pas d'identifiant de compte, d'équipe, de projet ou de clé dans ces pages.
