# Analyse de l'entraînement — volumes, répartition et couverture

8 novembre 2026, développement depuis `dd83b45`, PR #45 en brouillon. Preuve attachée au commit contenant ce document. Bases locales jetables `tartan_v11_test` et `tartan_v11_e2e` ; aucune migration ni activation en production.

## Ce qui est implémenté

Service, contrats Zod et API communs aux écrans web et natifs. Depuis Suivi ou Progrès : cible groupe/athlète, quatre semaines, douze semaines, un an ou période d'une phase visible. Le contexte ne contient ni note privée ni santé. Les accès sont vérifiés par espace, rôle et cible, avec flag progression requis.

Le prévu utilise exclusivement les prescriptions individuelles conservées à la publication ou à la saisie. Aucun maximum actuel ni nouvelle fiche d'exercice ne reconstruit le passé. Une prescription ancienne absente reste inconnue. Le réalisé vient des séries de travail effectivement enregistrées : échauffements et séries non faites exclus, assistance et poids du corps non convertis en tonnage. Répétitions par côté respectées. Tonnage, mètres, secondes et contacts restent séparés. Les contacts prescrits sont déjà un total d'exercice ; distances et durées sont multipliées par le nombre de séries explicitement prescrit.

Les courbes hebdomadaires partagent une échelle commune, un zéro visible, des styles de trait distincts et des tableaux équivalents. Les données absentes coupent les courbes. Les bornes sont des débuts de semaine ; les semaines aux extrémités peuvent être partielles. La période précédente de même durée conserve sa propre couverture.

Les compteurs distinguent attributions par athlète, validations, détail renseigné, séries connues et couverture par mesure. Les statuts « manqué » créés automatiquement ne comptent pas comme des réponses. Une séance collective n'est pas un événement unique dans les totaux individuels : chaque destinataire compte, sans doublon groupe + attribution directe. La population d'un filtre groupe est celle des membres actuels. Dans l'historique d'un athlète, sa prescription passée conservée reste comptée après sa sortie du groupe ; elle ne lui réattribue pas le futur.

Répartition par identité d'exercice et catégorie conservée, occurrences par athlète et diversité sur 28 jours. Pas de fusion d'identités par nom ; un ancien item sans identifiant n'augmente pas le nombre de références distinctes. Aucun jugement de variété suffisante ni score opaque.

Le total RPE × minutes nécessite consentement et deux valeurs. Les colonnes santé ne sont pas lues sans consentement. Une lecture coach autorisée est journalisée sans contenu santé. Les analyses natives restent en mémoire, isolées par compte/espace/rôle, ne s'affichent pas après refus serveur ni pendant revalidation et n'entrent pas dans le cache persistant.

## Vérifications

- Suite serveur complète : **563 tests réussis, 56 fichiers, 57,60 s**. Après la correction de conservation du passé lors d'une sortie de groupe : **11 tests ciblés d'analyse réussis**, incluant ce cas et l'absence de réattribution future.
- Suite domaine : **141 tests réussis**. Après ajout de l'assertion d'échelle commune : **19 tests ciblés analyse/historique réussis**.
- Cas calculés : 3 × 4 × 40 = 480 kg prévus ; deux séries réelles = 320 kg ; aucune saisie = volume réalisé absent. Échauffement, unilatéral, assistance, unités, absence de maximum et de convention couverts.
- Cas serveur : refus inter-espace et hors groupe, accès athlète, flag désactivé, phases privées cachées à l'athlète/adjoint, aucune note privée dans le contexte, santé non lue sans consentement, données historiques absentes non reconstruites, groupes synthétiques de 30/60/120 athlètes sans double attribution.
- **Deux parcours navigateur sur build de production réussis en 32,1 s**, desktop et web mobile : quatre semaines de séances, trois validations partielles, comparaison 1 920 kg prévus / 960 kg réalisés, API via client natif partagé, filtres athlète/phase, données absentes, Axe, 390/768/1440 px et zoom 200 %. Le dernier contrôle serveur de sortie de groupe est couvert séparément après cette recette.
- Types monorepo réussis après le dernier contrôle. Lint : zéro erreur, quatre avertissements préexistants ; Impeccable statique : zéro travers. Export Hermes iOS et Android réussi après les changements d'interface.
- [Capture desktop](images/analysis-desktop.png), [capture mobile](images/analysis-mobile.png). Relecture visuelle : méthode repliée et compteurs sur deux colonnes pour rapprocher les courbes du début de l'écran mobile. Les barres fixes figurant au milieu d'une capture pleine page sont positionnées à la borne du viewport de capture ; les contrôles de navigation et de débordement sont exercés séparément.

UI/UX Pro Max : première recherche hors sujet, puis `time series trend --domain chart` donnant « Trend Over Time / Line Chart », pertinent pour les séries hebdomadaires. Styles de traits et table équivalente retenus ; couleurs du dépôt conservées. Frontend Design : surfaces de travail, Barlow et rouge piste, sans animation ni décoration supplémentaire. Impeccable et contrôle React complètent types, lint, Axe et captures.

## Limites et suite

Le filtre de phase utilise **sa période et sa cible actuelles**, pas un rattachement historique de séances : l'interface le précise. Le contexte sélectionné est désormais conservé et revalidé à la publication ([preuve](lot-d-phases.md)) ; son raccordement à ces statistiques reste à faire. La classification par mouvement/matériel, les intensités comparables et les courbes de charge ressentie restent à compléter ; le présent écran expose déjà le total renseigné et sa couverture. Les fenêtres d'analyse sont limitées à 366 jours et 5 000 séances publiées ; au-delà, une erreur demande de réduire la période, sans résultat tronqué présenté comme complet.

Les essais de transport API natif et exports Hermes ne remplacent pas la recette interactive sur iPhone/Android physiques, VoiceOver/TalkBack ou les essais coachs. L'outil de contrôle du simulateur reste bloqué par le verrouillage du Mac. Cette preuve ne valide ni l'IA, ni les services externes, ni la commercialisation ou les stores.
