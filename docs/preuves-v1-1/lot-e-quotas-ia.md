# Quotas IA persistants et reprise après panne

8 novembre 2026, depuis `2aa1e1f`, PR #45 en brouillon. Migration `20261108070000_ai_planner_usage`.

## Garanties implémentées

Les compteurs de propositions et secondes audio sont partagés par espace, dans son mois civil. Le fuseau est stocké avec le défaut Europe/Paris, compatible avec les comportements actuels. Coach/pilote : 30 propositions et 3 600 secondes ; Club : 150 et 18 000. Découverte et les espaces désactivés ne peuvent pas réserver. Aucun dépassement payant.

Les réservations et leur identifiant de requête sont persistants, sous verrou de l’espace. Une même requête en concurrence n’obtient qu’un bail ; la seconde voit un traitement en cours. Changer son contenu ou sa durée sous le même identifiant est refusé. Chaque résultat enregistré porte une référence et une version ; texte, audio et réponse fournisseur ne sont pas stockés dans ce registre.

La confirmation du résultat et la consommation sont dans la même transaction. La réponse perdue se retrouve sans réécriture du résultat ni double consommation. Un échec SQL conserve la réservation pour reprise ou restitution, sans valider une consommation partielle. Aucun appel fournisseur n’a lieu sous verrou SQL.

Le bail dure cinq minutes. Une réponse tardive ne peut pas ressusciter une opération restituée. L’échec sans résultat exploitable libère le quota une seule fois. Le cron horaire restitue les baux expirés, même IA désactivée ; une nouvelle demande le fait aussi pour son espace avant de calculer le disponible. Le traitement agrège les restitutions par mois.

Droits et drapeaux sont recontrôlés sous verrou. Une opération d’un autre auteur n’est pas récupérable ; une révocation interdit l’enregistrement. La suppression du compte met son identifiant à null, sans perdre la réservation à restituer. Les contraintes SQL empêchent les compteurs négatifs et les états/coûts incohérents.

Les métadonnées d’opération expirent le neuvième jour du mois suivant ; les agrégats sans identité sont conservés deux mois civils après leur mois d’usage. La future couche de propositions devra refuser les requêtes expirées avant toute réservation : le registre ne constitue pas un archivage illimité des clés d’idempotence.

## Preuves

- **13 tests de quotas**, inclus dans **35 tests ciblés** avec adaptateur, cron et isolation : concurrence, dernière place, secondes audio, rejeu modifié, échec SQL, remboursement répété, bail expiré, arrêt global, auteur/révocation, Coach/pilote/Club/Découverte, suppression d’un coach et mois local.
- **608 tests serveur réussis**, 62 fichiers, 51,98 s.
- Types du monorepo réussis ; lint ciblé sans erreur. Aucun écran modifié dans ce lot.
- Base vierge : les tests reconstruisent les 34 migrations. Copie synthétique de l’ancien schéma : 33 migrations, espace ancien et nouvelle insertion avec les anciennes colonnes conservés ; passage à 34 en **0,024 s**, 24 exercices initiaux inchangés, aucune opération IA créée. Base dédiée supprimée après vérification. Le premier fixture utilisait les noms TypeScript des colonnes Better Auth ; corrigé vers les noms SQL avant la recette finale.
- Preview `br-floral-sun-b9iar8ge` : 33 → 34 en **3,34 s** ; zéro compte/opération, drapeaux désactivés et droits SELECT/INSERT/UPDATE/DELETE du rôle applicatif sur les deux tables vérifiés. Production non ciblée.
- Base locale du simulateur migrée également.

## Déploiement et limites

Migrations additives uniquement. Déployer les migrations avant le code : le cron utilise les nouvelles tables même lorsque l’IA est désactivée. En retour arrière applicatif, conserver les tables ; l’ancien code les ignore. Ne pas supprimer les registres pour remettre artificiellement les quotas à zéro.

Le service est interne, sans endpoint public. L’empreinte doit être construite côté serveur, la durée audio mesurée côté serveur, et la couche de workflow doit confirmer le résultat dans la transaction fournie. Il reste à implémenter les propositions, les clarifications incluses limitées à cinq échanges, la transcription, les contrôles de rythme, la purge des textes, les brouillons et toutes les interfaces. Aucun appel OpenAI réel ni test de dictée n’est revendiqué.
