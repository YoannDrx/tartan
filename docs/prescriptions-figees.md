# Prescriptions individuelles figées

Avec la progression activée, publier une séance crée, dans la même transaction, une copie par athlète et version de séance. Chaque item conserve sa prescription effective, sa charge résolue ou son absence, et la référence utilisée avec sa provenance et son pas d’arrondi. Les règles pures sont dans `packages/domain/src/prescription-snapshot.ts` ; l’orchestration transactionnelle est dans `apps/web/src/server/prescription.service.ts`.

## Comportements

- Ajouter un maximum, choisir une autre référence, modifier le pas d’arrondi ou supprimer le test source ne réécrit pas une charge déjà publiée.
- Déplacer une séance ou changer une consigne crée une version de séance, en conservant les charges des items inchangés. Modifier la prescription de charge ou ajouter un nouvel item utilise la référence actuelle. Les versions précédentes restent conservées.
- Un pourcentage sans référence reste non calculable. Ajouter un maximum plus tard ne complète pas silencieusement les anciennes prescriptions.
- Les adaptations sont appliquées uniquement à leur athlète. L’autonomie reçoit ses propres items ; les charges club existantes restent conservées.
- Une arrivée dans le groupe, par fiche coach ou invitation, fige les séances auxquelles l’athlète accède au moment de son attribution. Le passé du groupe n’est pas attribué au nouvel arrivant.
- Une validation simple mémorise la version de prescription utilisée, sans prétendre que ses séries ont été renseignées. Une validation détaillée conserve sa propre copie ; les corrections gardent cette référence historique.
- La validation rapide du coach incrémente aussi la version de validation et conserve son auteur. Elle invalide une saisie détaillée concurrente sans effacer ses données.
- L’export de l’athlète comprend ses références, prescriptions et séries. Supprimer sa fiche supprime ses copies, sans toucher celles des autres athlètes.

## Transactions et compatibilité

Les écritures prennent le verrou de l’espace avant celui de la séance. Le choix d’une référence et la publication sont ainsi sérialisés. Le chargement des références est regroupé pour l’ensemble des destinataires ; il n’effectue pas trois lectures par athlète. Une erreur d’écriture d’une copie annule la publication entière ; aucune notification de publication ne part dans ce cas.

La migration `20261107220000_frozen_prescriptions` ajoute `session_prescriptions` et le marqueur `prescription_frozen_at`. Elle ne retire aucune colonne. Elle ne fabrique pas de copie historique à partir des maxima actuels. Les séances déjà publiées sans marqueur restent sur le chemin de compatibilité ; leur première révision avec la progression activée crée une copie à la date de cette révision. Une ancienne réalisation détaillée conserve toujours sa propre copie.

Désactiver la progression empêche les nouvelles saisies détaillées, mais ne retire pas les copies existantes et ne rend pas les charges historiques dynamiques. Les anciennes apps peuvent toujours corriger une validation simple. Elles ne peuvent pas effacer des séries détaillées ou modifier sans version une séance munie de copies individuelles.

## Recette

Les tests couvrent publication sans lecture préalable, changement/suppression de maximum, absence de référence, modifications de séance, adaptations, arrivée par groupe/invitation, autonomie, double publication, rollback sur échec SQL, validation simple ancienne app, validation rapide coach, export/suppression et groupe de 120 athlètes. Le navigateur vérifie aussi qu’après publication à 80 % d’une référence de 100 kg, choisir ensuite une référence de 90 kg laisse la charge publiée à 80 kg.

Le gel ne remplace pas la saisie du réalisé : les interfaces détaillées athlète et coach existent désormais sur web et natif (lot coach `4d2df2c`), derrière le drapeau de progression. Une commande explicite d’actualisation des charges sur une séance déjà publiée sera à prévoir dans le constructeur ; une simple modification de consigne ne constitue pas cette demande. La recette de performance menée ici sur Postgres local ne vaut pas mesure de latence en production.
