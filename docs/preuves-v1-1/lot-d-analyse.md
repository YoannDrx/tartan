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

Le filtre de phase utilise **sa période et sa cible actuelles**, pas un rattachement historique de séances : l'interface le précise. Le contexte sélectionné est désormais conservé et revalidé à la publication ([preuve](lot-d-phases.md)) ; son raccordement à ces statistiques reste à faire. La classification par mouvement/matériel, les intensités comparables restent à compléter. Les courbes de charge ressentie sont ajoutées dans le complément ci-dessous. Les fenêtres d'analyse sont limitées à 366 jours et 5 000 séances publiées ; au-delà, une erreur demande de réduire la période, sans résultat tronqué présenté comme complet.

Les essais de transport API natif et exports Hermes ne remplacent pas la recette interactive sur iPhone/Android physiques, VoiceOver/TalkBack ou les essais coachs. L'outil de contrôle du simulateur reste bloqué par le verrouillage du Mac. Cette preuve ne valide ni l'IA, ni les services externes, ni la commercialisation ou les stores.


## Complément — charge ressentie hebdomadaire

8 novembre 2026, depuis `eeb825e`, mêmes bases synthétiques locales. Web et natif affichent désormais la somme hebdomadaire RPE × minutes, son nombre de réponses complètes parmi les validations avec consentement et la comparaison avec la période précédente. Aucune nouvelle lecture de données ni migration : le service de consentement et les agrégats existants sont réutilisés.

Une semaine sans réponse reste absente et coupe le trait. Un zéro renseigné reste zéro ; deux semaines connues suffisent pour tracer les points. Les unités arbitraires restent distinctes du tonnage, des mètres et des secondes. Aucune estimation des réponses manquantes, score global ou qualification de risque. Les explications rappellent que la somme d'un groupe dépend aussi du nombre de répondants.

La synthèse et la couverture restent visibles ; les explications et le tableau équivalent sont dépliables. Le SVG est décoratif pour les lecteurs d'écran. Les axes temporels, l'origine zéro, les points et le tableau utilisent les mêmes données sur web et natif. Aucun mouvement ajouté. Relecture de la première capture : en-tête trop long et explications occupant le début de la section ; libellés raccourcis et explications repliées, puis recette répétée.

- **11 tests domaine et 11 tests serveur ciblés réussis** : valeurs distinctes, unités, absence de substitution, coupure des points manquants, zéro connu, couverture et absence des valeurs hebdomadaires sans consentement.
- **Deux parcours navigateur de production réussis en 28,2 s** après la correction visuelle : 200 + 280 unités renseignées, semaine intermédiaire absente, couverture 2/3, absence de segment entre les deux points, tableau et masquage après retrait du consentement. Le contrôle HTTP prouve aussi l'absence des valeurs dans la réponse, pas seulement leur masquage visuel.
- Axe, largeurs 390/768/1440 et zoom 200 % exercés. [Capture desktop](images/analysis-health-desktop.png), [capture web mobile](images/analysis-health-mobile.png) ; captures sans masquage des barres fixes.
- Types monorepo verts ; types natifs revérifiés après le dernier ajustement. Lint sans erreur avec les quatre avertissements préexistants ; Impeccable statique sans travers. Export Hermes iOS/Android vérifié pour ce lot.

La passe visuelle reprend le choix « Trend Over Time / Line Chart » issu de UI/UX Pro Max pour l'écran d'analyse, les surfaces et la typographie du dépôt, puis contrôle React, Impeccable, captures et Axe. Elle ne remplace pas VoiceOver/TalkBack ni une recette sur téléphone. Aucun envoi de données santé à un prestataire ou à un journal ajouté. La PR reste en brouillon ; phases historiques, mouvements/matériel, intensités, IA et recettes externes restent ouverts.
