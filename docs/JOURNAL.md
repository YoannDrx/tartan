# Journal de passation

Chaque agent ajoute une entrée en haut, à la fin de son travail. Cinq lignes suffisent. L'état d'avancement reste dans [ETAT.md](ETAT.md) : ici, seulement ce qu'un autre agent doit savoir pour reprendre.

Modèle :

```text
## AAAA-MM-JJ, agent, sujet
Fait : … (PR)
Vérifié : … / Non vérifié : …
En cours ou abandonné : branche, raison
À savoir : piège découvert, décision prise
Suite conseillée : numéro de tâche
```


## 2026-11-14, Claude, phase C : constructeur et mode séance (web)
Fait (PR `feat/constructeur-v2`, empilée sur la phase B) : domaine `insert`, `moveSequenceNode`, `groupSequenceSelection`, `prescriptionForGroup`, `sequenceGroupSummary`, `findSequenceNode`, `sequenceGroups` (testés) ; `exercise-picker.tsx` (recherche, familles nommées) ; `sequence-editor.tsx` réécrit selon la maquette validée (cartes colorées par famille, cadre de groupe « × n », récupération en ligne pointillée, menu « Autres actions » : dupliquer, déplacer, dissocier, retirer ; sélection puis « Regrouper ») ; destination de la bibliothèque dans `session-builder.tsx` ; mode séance au minuteur calé sur l'horloge, enchaînement, son, vibration, réveil d'écran, aperçu de l'étape suivante.
Vérifié : domaine (304), `session-sequences.spec.ts` (4 parcours, axe à 390, 768 et 1440 px dans les trois thèmes), essai manuel local du sélecteur, du déplacement et du minuteur.
À savoir : le service worker de la PWA sert d'anciens fichiers en développement ; le désinscrire avant un essai local (`navigator.serviceWorker.getRegistrations()`).
Suite : glisser-déposer, séries détaillées, variante par nœud, portage mobile (phase G), puis phase D.

## 2026-11-14, Claude, phase B : correctifs bloquants
Fait (PR `fix/phase-b-seances`, empilée sur la phase A) : `loggableItems` (domaine) écarte les récupérations de la saisie des séries, web et mobile ; `mergeVariantBlocks` remet les blocs communs de fin après le corps de séance en autonomie ; `occurrenceRef` garde la référence d'origine hors de tout groupe (aucune séance V2 en production, donc rien à migrer) ; séries précédentes triées par position dans la copie figée. Vidéo : camarades sans remarques du coach ni annotation, « À travailler » limité aux coachs, suppression réservée à l'auteur, essai de saut refusé à l'athlète. Mobile : file vidéo par compte (`ownership.ts`), arrêt sur 401. Catalogue version 3, CGV et conditions déplacées dans i18n (`lint:prune`), bannière « version de travail » retirée. IA : contrôles actifs après une question, sur la seule part du coach (`plannerCoachText`) ; destinataires couverts en mode « Proposer ».
Vérifié : chaque correctif a un test qui échoue avant ; suite web complète, domaine et mobile.
À savoir : renommer une fiche de l'ancienne bibliothèque casse son rattachement (`buildEntry` compare les noms) ; ne pas renommer « Mobilité des hanches » et consorts sans migrer ce lien. Le mode « Proposer » contrôlait déjà date, durée et nombre de séances (`ai-planner.ts`), contrairement à ce que disait l'audit.
Ajout : quota vidéo par athlète confirmé (8 et 20) : `assertUploadReservation` choisit le quota selon l'auteur, `usageOf` exclut les envois d'un athlète pour lui-même ; CGV et comparatif à jour.
Suite : phase C (maquette validée).

## 2026-11-14, Claude, audit de la finalisation et phase A
Fait : audit des PR 119 à 129, des prestataires et du code ; constats et plan en phases A à G dans `ETAT.md` et `plans/web.md`. Phase A (PR `fix/phase-a-exploitation`) : analyse des secrets, protection à l'envoi et Dependabot activés ; `LICENSE` propriétaire ; job `mobile-gate` toujours présent, à exiger sur `main` ; transition de page interrompue ignorée par Sentry ; incident du 13 novembre consigné ; décisions du fondateur du 14 novembre dans `PRODUCT.md`.
Prestataires : calcul Neon de production relevé de 0,25 CU fixe à 0,25–2 CU (réglage de recette hérité de la restauration) ; branches de recette et ancienne production supprimées sur accord, après contrôle d'absence d'écriture postérieure au point restauré ; `preview` reconstruite sans donnée de production (schéma, historique des migrations, graine), variables Preview de Vercel repointées, branche Git `preview` avancée sur `main`.
À savoir : l'avertissement `sslmode` des journaux venait de la Preview, construite sur un ancien commit, pas de la production. `sslrootcert=system` sert à `psql`/`pg_dump`, jamais à node-postgres (ENOENT). `neonctl cs` exige `--role-name tartan_owner` (deux rôles). Mot de passe démo Preview : `.local/preview-demo-password`, hors dépôt.
Suite : `EXPO_TOKEN` et plafond OpenAI (fondateur), puis phase B.

## 2026-11-14, Codex, F9 : attente de la feuille de validation
La PR 127 échoue sur l'attente de cinq secondes du bouton de fermeture, après validation réussie. Capture et arbre d'accessibilité montrent ensuite la feuille « Séance validée » et le bouton `validation-finish` visible et actif ; aucune erreur serveur. Attente conditionnelle portée à quinze secondes, sans deuxième soumission ni assertion retirée. Cette marge du pilote ne prouve pas le critère de dix secondes sur téléphone, qui reste à mesurer. Rejeu ciblé réussi sur iPhone 16e simulé en 1 min 20 ; types/lint/design réussis (quatre avertissements hérités). Nouvelle CI de la tête requise.

## 2026-11-14, Codex, F9 vidéo : intégration du setup complet
Reprise de la PR 127 avec le correctif commun de la PR 126 : catalogue groupé, graine complète et attente bornée du constructeur. La dernière CI échouait uniquement sur ce premier constructeur. Aucun contrôle vidéo retiré ; nouvelle CI de la tête requise.


## 2026-11-14, Codex, reprise F9 après diagnostic du catalogue
Reprise autorisée de la PR 126. La trace du premier constructeur montre une réponse lente et, dans l’assemblage final, une expiration P2028 de l’installation initiale du catalogue. Ajouts communs groupés dans la même transaction ; graine complétée avec les 150 fiches avant les parcours. Attente de l’écran bornée à 30 s ; aucun clic automatique de reprise ni assertion supprimée. Les contrôles du code commun et l’installation/reprise de la graine passent ; CI de cette tête requise avant fusion.


## 2026-11-14, Codex, diagnostic final des deux échecs natifs
La trace finale confirme un HTTP 500 P2028 après 27,3 s sur le contexte du constructeur : l’installation initiale du catalogue, encore séquentielle, expire. L’insertion groupée et la graine complète corrigent ce chemin ; aucun délai de transaction supplémentaire ajouté. Le second échec est propre à la recette IA : le bouton final est entièrement visible et actif dans la capture et l’arbre d’accessibilité, mais `centerElement` exige une position impossible en bas de page. Centrage retiré de cette seule recherche, clic et création effective du brouillon toujours exigés. Rejeu ciblé local réussi en 3 min 12 sur iPhone simulé, création effective du brouillon vérifiée par le parcours ; CI complète encore requise.

## 2026-11-14, Codex, premier chargement du catalogue
La CI native reste rouge sur l’ouverture du constructeur simple, y compris après une attente de 30 s ; aucun correctif déclaré éprouvé sur cette seule hausse. La trace réseau d’une exécution précédente montre une réponse du contexte en 16,5 s. L’installation initiale des fiches communes utilisait 150 écritures successives ; les ajouts passent désormais par une insertion groupée, sous les mêmes verrous et avec mises à jour éditoriales séparées. Le setup de démonstration installe aussi les 150 fiches dès la graine, au lieu de les laisser à la première ouverture ; création neuve et rejeu inchangé vérifiés sur base jetable, ensuite supprimée. Les cinq tests de catalogue et la suite locale complète passent (1 969 web, 294 domaine, 252 mobile, types/lint/design). La validation finale iOS reste requise ; les fusions attendent un assemblage vert.

## 2026-11-14, Codex, assemblage final des PR 124 et 126–129
Les quatre lots natifs sont réunis dans la PR 124 avec main, sans conflit de code ; les journaux et les preuves d’exploitation sont conservés. Les PR d’origine ciblent main et restent ouvertes jusqu’à leur validation et à l’intégration finale. Autorisation de fusion et nettoyage Git déjà donnée par le fondateur ; aucune protection désactivée. Derniers correctifs : première confirmation de lien iOS éprouvée sur simulateur neuf, révision de circuit sous contention reproduite puis corrigée. CI complète de chaque tête et de l’assemblage suivie dans les PR ; preuve de déploiement à ajouter dans la PR 124 après observation. Inscriptions fermées, aucune qualification IA ni validation de téléphone déduite de ces fusions.


## 2026-11-14, Codex, F1 : sauvegarde de main et restauration vérifiées
Après fusion de la PR 125, production `4b2004b` saine, version attendue et journaux ciblés sans erreur. Workflow de sauvegarde main `43552436123` réussi : copie privée de 03 h 36 UTC, 382 745 octets relus à l’identique. Restauration locale isolée en 0,37 s : 83 tables, 51 migrations et 150 guides approuvés, aucune migration échouée ni contrainte non validée. Base, fichier chiffré et secrets temporaires retirés ; preuves conservées hors dépôt public. Cette recette Blob ne remplace pas la restauration Neon isolée encore attendue.
## 2026-11-14, Codex, F9 : sauvegarde de circuit sous contention
Reprise autorisée de `feat/native-planner-modes`. La CI montre un constructeur encore en chargement au seuil de 15 s et une révision réellement refusée par Prisma (`P2028`). La sauvegarde dispose désormais de 30 s, comme la publication groupée, sans retirer les verrous, le contrôle de version ni le gel historique. Test PostgreSQL avec verrou concurrent : échec reproduit sur l’ancien délai (5 509 ms), réussite après correction et prescriptions précédentes inchangées. Les 39 tests ciblés circuits/identité/prescriptions passent. Attentes natives bornées à 30 s au chargement et 45 s après sauvegarde, assertions et contrôle serveur conservés. Suite complète et CI à rejouer ; aucun gain de performance sur téléphone revendiqué.


## 2026-11-14, Codex, état du plan et dépendances des PR
Réconciliation d’ETAT : distinction des lots de finalisation et des anciennes actions F1–F17, retirant les lignes de produit copiées par erreur dans le tableau du fondateur. Statut actuel des guides approuvés, D-U-N-S envoyé, incident réparé et qualification IA encore insuffisante. Historique du journal conservé. PR 123–129 prêtes à revue, toutes autorisées à fusionner CI verte ; vérifications en cours. Aucun statut « éprouvé » déduit d’un test simulé. Après rétablissement, l’accès lecture seule de sauvegarde GitHub a également été corrigé ; export Blob relancé, résultat à confirmer.

## 2026-11-14, Codex, F9 : catalogue approuvé dans les recettes natives
Intégration des branches parentes et des 150 guides approuvés. Le scénario IA vérifie le brief accessible au lieu de l’ancien blocage éditorial ; création privée et confirmation réelle du brouillon restent exigées. Le constructeur simple passe en local (84 s) après traitement du dialogue de sauvegarde du mot de passe, sans modification du délai de chargement. Rejeux circuits et CI complète en cours ; aucun résultat de téléphone physique ajouté.

## 2026-11-13, Codex, F9 : modes IA et exercices inconnus sur le natif

Codé sur `feat/native-planner-modes` depuis le constructeur natif : choix mise en forme/proposition, objectif/durée/niveau/matériel/date, blocage explicite du mode proposition tant que le catalogue n'a pas de fiches techniquement validées. Questions d’exercice : candidats pertinents, création privée relue et convention de charge, rattachement idempotent avec reprise de la même demande après erreur ; texte de réponse préservé. Recherche par synonymes et suppression de l'ancien blocage à 500 fiches. Les choix et relectures affichent une coche visible en plus de leur état accessible.
Recette : scénario natif ajouté avec prestataire factice limité au local, jamais Vercel, et test serveur du parcours clarification → création → reprise. Deux échecs du pilote diagnostiqués sur captures : mode précédent encore actif puis champ multiligne sous le bandeau ; le scénario vérifie désormais la saisie et l’activation avant envoi. Le premier rejeu annoncé réussi (195 s) était un faux positif : la base conservait la proposition, sans brouillon. L’assertion historique visait une action disponible avant confirmation. Les deux scénarios vérifient désormais les charges, le bouton actif et le message réel de création ; rejeu final réussi (194 s), véritable message de création observé et base locale relue : état `committed`, exactement un brouillon. Capture finale relue à 390 px ; autres tailles, thèmes et Android restent à vérifier. La fermeture du clavier de consignes utilise son libellé, après vérification du texte saisi. Types/lint/design et suites complètes réussis sous Node 22/pnpm 10 : 1 961 web, 290 domaine, 252 mobile, 247 jeu, 90 mascotte ; quatre avertissements lint préexistants. Non-régression du parcours simple également réussie (111 s) après fermeture optionnelle du dialogue système de sauvegarde du mot de passe ; les deux propositions sont relues en base, chacune `committed` avec un brouillon. Aucune dictée humaine, aucun appareil physique ni nouvelle preuve OpenAI réelle.
Exploitation : incident d'authentification PostgreSQL toujours en cours ; branches conservées et fusions suspendues. Comparaison agrégée en lecture sur 76 tables concordante (comptes et dernières dates), sans conclure à l'égalité de toutes les lignes. Autorisation de transfert des identifiants de connexion et clarification de la restauration attendues du fondateur ; aucun secret lu pour ce diagnostic.
## 2026-11-14, Codex, F9 : reprise des PR natives
Reprise autorisée de `feat/native-session-sequences`, avec les corrections de sa branche parente. La capture CI du constructeur de circuit confirme la même boîte système iOS que le parcours athlète : sous-parcours commun ajouté après l’ouverture du lien. Le premier test de création affichait encore le chargement, diagnostic et rejeu local en cours ; aucun délai augmenté ni assertion retirée.

## 2026-11-13, Codex, F9 : constructeur natif de séances imbriquées

Codé sur `feat/native-session-sequences`, après la vidéo native : cartes d’exercices, de récupération et de répétition, deux niveaux maximum ; ajout, ordre, duplication, dissociation, déplacement entre phases et annulation du dernier changement de contenu. Séries et adaptations existantes conservées. Aperçu utilisant les occurrences du domaine. Contrat d’édition local partagé avec le web : un groupe incomplet survit à la fermeture, mais ne passe pas le contrat serveur. Déplacement métier conservant les identifiants et prescriptions, suppression des groupes devenus vides.
Vérifié sous Node 22/pnpm 10 : types, lint (quatre avertissements hérités), design et suites complètes : 1 960 web, 290 domaine, 252 mobile, 247 jeu, 90 mascotte. Maestro local réussi sur iPhone 16e/iOS 26.3 : édition de deux à trois tours d’un circuit publié, aperçu, enregistrement, puis ajout d’un groupe imbriqué de trois tours ; lecture API vérifiant structure, ordre, pauses, références et prescriptions. 1/1 en 132 s, captures 390 px relues. L’échec intermédiaire cliquait sous l’en-tête ; centrage du bouton ajouté, assertions conservées.
Limites : bundle Hermes intégré au binaire simulateur existant, pas de nouvelle compilation native locale ; CI attendue. Autres tailles/thèmes, Android, appareils physiques et stores non prouvés. Aucun parcours web produit modifié : seule l’extraction du contrat local d’édition conserve son comportement. IA native encore à porter. Aucun statut commercial acquis ; incident d’authentification de production traité séparément, fusions suspendues.

## 2026-11-14, Codex, F9 : reprise de la branche vidéo native
Reprise autorisée de `feat/native-video-collaboration` pour intégrer le correctif de première ouverture iOS de la PR 126 et main. La trace de la PR 127 échoue au même endroit, avant livraison du lien ; toutes les autres étapes de sa recette passent. Aucun changement de vidéo, nouvelle CI requise.


## 2026-11-13, Codex, F9 : vidéo collaborative native

Codé sur `feat/native-video-collaboration`, après le lot guides : bibliothèque paginée commune, filtres athlète/traitement/revue, capture privée sans identité athlète fournie par le client et rattachement depuis la séance. Clé idempotente conservée dans la file durable, y compris après migration des anciennes entrées. Réponses horodatées, partage explicite au groupe et révocation, revue coach et suppression selon les permissions renvoyées par le serveur. Nouvelles routes natives réutilisant les services existants ; refus d'accès masquant les anciennes données en cache.
Vérifié : types/lint (quatre avertissements hérités)/design, 1 960 tests web, 289 domaine, 251 mobile, 247 jeu et 90 mascotte. Matrice HTTP et tests vidéo ciblés : 811 réussis. Deux parcours Maestro locaux réussis sur iPhone 16e/iOS 26.3 (390 px), captures relues : capture privée et capture liée au circuit ; aucun sélecteur d'identité athlète. Bundle Hermes intégré au binaire simulateur existant, compilation native fraîche attendue en CI.
Non éprouvé : upload Mux depuis le natif, reprise sur téléphone, partage/commentaires dans l'interface native, thèmes/tailles restants, Android physique. Pas de parcours web visuel modifié ; suite navigateur complète laissée à la CI. PR en brouillon, aucune nouvelle fusion autorisée par ce travail.
## 2026-11-14, Codex, F9 : réactivation après confirmation iOS
La seconde trace (PR 127) précise le problème du premier lien : l’app reste sur son accueil après « Open » ; dans la PR 126, SpringBoard ne livre UIOpenURLAction qu’à la réactivation suivante. Après cette confirmation uniquement, Maestro remet désormais l’app au premier plan sans l’arrêter ni effacer sa session (`launchApp`, `stopApp: false`). Rejeu sur simulateur iPhone 16e neuf réussi en 1 min 49, avec confirmation « Open » et réactivation effectivement exécutées, puis les mêmes assertions des sept étapes et du guide. Aucun changement applicatif ni preuve sur appareil physique.


## 2026-11-14, Codex, F9 : délai du premier lien iOS
Reprise autorisée de `feat/native-completion`. La trace CI montre le dialogue système accepté, puis une requête de séance démarrant environ 20 s après l’appui, au-delà de l’attente de 15 s ; l’assertion échoue avant ce démarrage. Attente conditionnelle de la première étape portée à 30 s, sans pause fixe, reprise ni retrait des sept étapes vérifiées. Le même parcours passe déjà sur la PR 128. Rejeu ciblé local réussi en 1 min 46 : sept étapes et guide vérifiés ; CI du correctif requise. Aucune preuve de performance sur téléphone déduite du simulateur.


## 2026-11-14, Codex, F9 : dialogue de sauvegarde du mot de passe
Rejeu local du constructeur interrompu après connexion : capture montrant le dialogue iOS d’enregistrement du mot de passe devant le suivi. Refus optionnel ajouté au sous-parcours commun de connexion, pour tous les scénarios ; aucune assertion applicative supprimée. Le chargement observé en CI reste distinct de ce dialogue et n’est pas déclaré corrigé sans rejeu.

## 2026-11-14, Codex, F9 : confirmation des liens iOS dans la CI
Reprise autorisée de `feat/native-completion` pour réparer les PR ouvertes. L’artefact de la CI montre la boîte système « Open in Tartan Dev? » devant la séance ; les échecs de connexion suivants sont consécutifs à cette boîte restée ouverte. Le parcours accepte explicitement cette confirmation quand elle apparaît, sans retirer l’assertion des sept étapes ni les contrôles de guide/récupération. Rejeu requis en CI ; aucun défaut du circuit déduit de ce blocage système.

## 2026-11-13, Codex, F9 : guides et exécution native des circuits

Codé sur `feat/native-completion`, depuis F5 : guides dans la bibliothèque, fiche et séance, recherche par famille ; cache des textes et préchargement des illustrations disponibles des sept jours à venir. Aucun visuel en préparation n’est chargé ni déclaré validé. Récupérations explicites avec minuteur, tours visibles, saisies distinctes par occurrence, repos final explicite respecté. Séries locales redimensionnées après modification, récupérations exclues de la saisie détaillée, accès refusé par le serveur masqué même avec un cache.
Vérifié : types/lint/design, 1 945 tests web, 289 domaine, 249 mobile après ajout du dernier test de cache (247 jeu, 90 mascotte). Deux parcours Maestro locaux réussis sur iPhone 16e/iOS 26.3, 390 px : synonyme « back squat » vers le guide, puis circuit A/repos/B/repos de tour/A/repos/B et guide athlète. Captures relues. Binaire simulateur existant avec nouveau bundle Hermes exporté ; ce n’est pas un nouveau build signé. Le premier essai a été arrêté par la proposition iOS d’enregistrer le mot de passe : refus facultatif ajouté, parcours complet rejoué. Tests locaux sur base jetable dédiée, aucun compte de production.
Non vérifié : matrice native complète des tailles/thèmes, téléphone physique, SVG technique réel (encore absent), stores. Suite web complète non rejouée : aucun parcours web modifié ; CI et compilation native fraîche attendues. F9 reste partiel : constructeur natif, modes IA et collaboration vidéo à porter.
## 2026-11-14, Codex, F5 : isoler le cas de catalogue non approuvé
La suite CI complète révèle une dépendance d’ordre : le test de refus du mode proposition supposait le catalogue partagé absent, alors que d’autres fichiers ont installé les 150 guides désormais approuvés. Le scénario rend sa précondition explicite, restaure les guides en fin de test et conserve les assertions de refus avant tout appel IA ainsi que celles des charges inventées. Ce défaut n’apparaissait pas au lancement isolé du fichier ; rejeu conjoint puis suite complète requis.

## 2026-11-14, Codex, F5 : intégration du catalogue approuvé
Reprise autorisée de la PR 124 avec le catalogue version 2 approuvé par le fondateur. Le parcours navigateur vérifie désormais l’accès au mode proposition et la conservation du brief ; les refus du service en l’absence de catalogue approuvé restent testés séparément. Cette approbation éditoriale ne change ni les résultats du corpus IA ni ses seuils. Contrôles ciblés et CI à rejouer avant fusion.

## 2026-11-13, Codex, F5 : comparaison réelle des modèles après les gardes

Sur le même code `42eaf34`, même corpus figé et mêmes attentes : GPT-4.1 mini 66/80 (82,5 %), GPT-4.1 72/80 (90 %), un passage de chaque modèle. Aucun cas critique détecté automatiquement sur ces deux passages ; relecture humaine toujours absente. Un résultat GPT-4.1 incomplet reste compté comme échec. Les gardes de date et de variante sont actives. Le seuil de 95 % n'est atteint par aucun modèle ; cette comparaison ne vaut ni qualification en trois passages ni autorisation d'ouverture.
Les divergences restantes incluent des clarifications de mouvements ambigus et des champs de question différents, ainsi que des récupérations et un ordre de circuit pour le modèle mini. Les attentes figées n'ont pas été réécrites pour améliorer les scores. Aucun modèle ni secret de production modifié. Rapports détaillés conservés localement, sans contenu utilisateur réel.

## 2026-11-13, Codex, F5 : qualification négative et refus des substitutions

Résultat OpenAI réel sur `9d09b5c`, 80 cas inchangés rejoués trois fois : 65/80, 64/80, 65/80. Seuil de 95 % non atteint. Relecture : les passages 1 et 3 acceptaient un lundi pour une demande du mercredi (F5-45) ; le passage 2 acceptait un épaulé au lieu du power clean (F5-13). Le correcteur masquait la date fausse derrière la clarification attendue d’un autre champ : corrigé et anciens résultats reclassés sans nouvel appel, consignes/attendus figés inchangés. Aucun « zéro erreur critique » revendiqué pour cette version.
Corrigé : garde sur le seul jour de semaine nommé, nom long prioritaire sur l’alias court contenu dans ce nom ; une réponse refusée devient une clarification, sans remplacement automatique. Cette garde a révélé une double lecture de « trente-sept virgule cinq kilos » comme deux charges : partie décimale consommée une seule fois. Tests de refus au niveau domaine et adaptateur prestataire.
Vérifié sous Node 22/pnpm 10 : types, lint (quatre avertissements hérités), 1 949 tests web, 288 domaine, 243 mobile, 247 jeu, 90 mascotte ; design sans écart. Les huit parcours navigateur IA simulés du correctif précédent passent (174 s). Pas de nouvelle preuve de dictée, d’approbation coach ou de téléphone. Prochaine comparaison sur le même corpus et la même implémentation, modèle configuré conservé en production.

## 2026-11-13, Codex, F5 : trois passages réels et récupération conservée

Corpus figé inchangé de 80 cas, OpenAI réel avec le modèle configuré, commit `4abf974` : 67/80, 67/80 et 68/80. Aucune erreur critique acceptée selon l'évaluateur automatique, relecture humaine toujours attendue ; seuil de 95 % non atteint. Les réponses révèlent notamment des erreurs d'ordre et de pauses dans les circuits et des clarifications incomplètes. Les attendus n'ont pas été modifiés.
Corrigé ensuite : un bloc de récupération seule était refusé par le contrat IA et supprimé par le nettoyage des citations. Il est désormais accepté avec une séquence valide, sans exercice fictif ; un bloc entièrement vide reste refusé. Consignes de structure renforcées : groupe sans copie préalable, petits groupes réellement imbriqués, pause explicite distincte du repos entre séries, ambiguïtés multiples et refus de maximum estimé à partir d'un prénom.
Vérifié sous Node 22/pnpm 10 : types/lint, 286 tests domaine, 243 mobile ; suite web 1 946 réussis et un ancien scénario corrigé qui plaçait aussi la pause entre tours dans le repos d’une série unique. Après correction de cette fixture, les 30 tests prestataire passent, soit 1 947 tests web distincts réussis. Garde supplémentaire : une pause V2 dans restS après une série unique est reprise une fois, puis transformée en clarification si elle resterait perdue. Rejeu navigateur en cours, nouvelle qualification complète requise. Les rapports bruts restent hors du dépôt public ; aucune dictée humaine ni approbation de coach déduite de ces exécutions.
## 2026-11-14, Codex, reprise du service et intégration Stripe
Reprise autorisée de `test/stripe-browser-recipe` et intégration de `main`, en conservant les recettes et journaux des autres lots. Connexion de production corrigée vers la branche actuelle avec TLS verify-full ; déploiement `0d9c4ef` puis fusion vidéo `56d0fff` vérifiés READY, santé OK et versions attendues. Aucun journal d’erreur sur ces nouveaux déploiements lors du contrôle. Les deux branches Neon restent conservées ; comparaison agrégée concordante sur 76 tables, sans conclure à l’égalité des lignes. La restauration finalisée ne compte pas comme preuve isolée. PR 121 fusionnée CI verte sur accord du fondateur ; branches Git locale et distante supprimées après vérification d’ascendance. Demande D-U-N-S envoyée après accord spécifique ; Apple confirme le traitement et annonce un e-mail, numéro pas encore attribué.

## 2026-11-13, Codex, incident de production et rectification de la preuve Neon

Constaté : après fusion autorisée de la PR 120, déploiement `0d9c4ef` en échec sur la connexion de migration ; `/api/health` retourne 503, version servie `75d3cbe`. Les journaux du cron signalent `P1000` (authentification refusée), notamment à 19 h 15 et 19 h 30 UTC. Connexion réseau/TLS disponible et requêtes techniques Neon réussies sur les deux branches.
Rectification de l’entrée précédente : l’API montre la restauration finalisée avec déplacement du calcul et de la protection vers la branche restaurée. L’affirmation « production inchangée » n’est donc pas une preuve valide. Ne supprimer aucune branche ni snapshot ; la demande de nettoyage antérieure est retirée. Les écritures récentes restent à rapprocher, sans conclusion de perte ou d’absence de perte.
En cours : checkout dédié pour corriger les preuves de la PR 125 ; fusions supplémentaires suspendues. Origine de la finalisation demandée au fondateur ; autorisation ciblée de transférer les identifiants valides vers Vercel puis redéployer demandée conformément à sa règle sur les secrets. Aucun accès communiqué dans le dépôt.
Suite : établir la branche de référence, rétablir l’authentification, vérifier santé/version/journaux, puis consigner la cause et l’impact réels avant reprise des fusions.

## 2026-11-13, Codex, F2 déployé et recette navigateur Stripe

Fait : fusion autorisée de la PR 119 après qualité et natif verts sur `2bea4fa`. Production `75d3cbe` READY, version vérifiée sur les deux domaines, aucun avertissement/erreur dans les journaux du déploiement consultés. La PR 120 est réactualisée sur main, nouvelle CI nécessaire ; accord de fusion déjà reçu pour 120 et 121.
Codé : réutilisation du checkout F2 propre, nouvelle branche `test/stripe-browser-recipe` depuis main pour F7. Recette explicite des pages Checkout et portail hébergées, transport CLI et webhook réel, base locale jetable seulement ; compte sandbox fourni localement, retiré du dépôt public.
Vérifié : six tests sandbox réels passent (194 s), dont les deux parcours navigateur. Carte standard et 3-D Secure, première facture, demande d’authentification après essai puis règlement depuis la facture hébergée, résiliation à l’échéance et maintien des droits. Les quatre tests API historiques sont rejoués. Reprise des deux parcours navigateur après renforcement du nettoyage : 2/2 (94 s). Types/lint/design verts (quatre avertissements existants), 1 905 tests web, 265 métier, 243 mobile, 247 jeu et 90 mascotte passent. Absence du compte sandbox refusée avant tout appel CLI (contrôle direct ; le formateur d’erreurs Vite masque cette exception dans le globalSetup). Suite Playwright ordinaire non relancée localement : aucun parcours applicatif modifié. Retour Tartan intercepté : aucune preuve de cet écran, d’un vrai paiement ou de la fiscalité.
À savoir : les formulaires Stripe sont dans des cadres intégrés ; sélectionner Carte bancaire avant les champs. Les captures pleine page perturbent le rendu, garder le viewport. La validation au clavier évite les clics prématurés pendant l’animation 3-D Secure. Le portail demande le motif avant la confirmation, et peut fixer `cancel_at` sans lever `cancel_at_period_end` : vérifier la date réelle et le miroir.
Exploitation : snapshot Neon au point demandé 17 h 35 UTC restauré dans une nouvelle branche isolée ; 83 tables et 49 migrations, empreinte des migrations et volumes fonctionnels identiques à la source. Production inchangée. Calcul temporaire borné à 0,25 unité avec suspension après 300 s (60 s refusé par Launch) ; snapshot expire le lendemain. Identifiants conservés uniquement dans une preuve locale ignorée.

## 2026-11-14, Codex, F3 : approbation et diffusion des 150 guides
Le fondateur déclare avoir relu et validé les 150 textes et autorise leur publication. Reprise de `feat/exercise-catalog-guides` : catalogue version 2 approuvé ; illustrations toujours brouillons, non produites ni approuvées. Mise à niveau des guides hérités au contenu identique, sans toucher prescriptions, personnalisation ou instantanés historiques. Trois tests domaine et cinq tests de service réussis, dont concurrence/idempotence et diffusion aux copies anciennes ; contrôles globaux en cours. Cette décision n’atteste ni les médias manquants ni la qualification du planificateur.
## 2026-11-13, Codex, F6 : diagnostic de la suppression native

Reprise de `feat/collaborative-video` : la CI native atteint la suppression finale mais le serveur retourne une erreur Prisma et conserve le compte. La capture confirme une saisie complète ; ce n'est pas un clic manqué. Le journal HTTP conserve désormais uniquement le code Prisma normalisé, sans message, requête ni métadonnées, afin de distinguer contrainte et expiration de transaction. Réponse publique inchangée. Neuf tests ciblés et suites complètes passent sous Node 22/pnpm 10 (1 918 web, 267 domaine, 243 mobile, 247 jeu, 90 mascotte) ; types, lint et design réussis, quatre avertissements lint hérités. Recette native à rejouer pour identifier la cause exacte. Aucune correction métier ni réussite de suppression déduite de cette instrumentation.
Exploitation : incident de production en cours, authentification PostgreSQL refusée et santé HTTP 503. La restauration Neon précédemment décrite comme isolée a été finalisée ; cette preuve d'isolation est retirée. Préserver les deux branches, aucune suppression ni fusion supplémentaire avant clarification et rétablissement. Détails techniques et identifiants conservés hors du dépôt public.

## 2026-11-13, Codex, F6 : intégration du correctif de recette F4

Reprise de `feat/collaborative-video` pour intégrer `db52511` sans changer le comportement applicatif ; journaux conservés. États F0/F1/F6 réconciliés avec les preuves récentes. CI à rejouer sur cette fusion avant de fusionner la PR 121 déjà autorisée.

## 2026-11-13, Codex, F4 : stabilisation de la recette native du suivi

CI qualité verte sur `427793a`, Android compilé ; douze parcours Maestro réussis, suivi coach en échec. La trace montre la grille visée à y=320 puis déplacée à y=497 par l'arrivée des alertes, sans navigation. Le test attend désormais le titre des alertes présentes dans la graine et la fin de leur animation avant de toucher la séance ; les assertions de l'appel restent identiques. Aucun changement applicatif. Rejeu natif requis avant fusion ; accord du fondateur déjà reçu, aucune fusion pendant cet échec.
## 2026-11-13, Codex, F5 : préserver la saisie pendant l’hydratation

Corrigé : la date d’expiration utilise explicitement le fuseau de l’espace. En CI, le serveur UTC et le navigateur Paris produisaient deux textes différents ; React reconstruisait le formulaire et perdait la précision saisie avant la fin de l’hydratation. Les traces des deux parcours en échec établissent cette cause.
Vérifié : serveur de recette désormais forcé en UTC ; huit parcours IA simulés réussis, dont création/reprise avec contrôle des erreurs navigateur et conservation du texte. Types, lint (quatre avertissements existants), 1 945 tests web, 284 domaine, 243 mobile et design vérifiés sous Node 22/pnpm 10. Aucun changement de modèle ni nouvelle qualification réelle dans ce correctif.
Suite : CI de la PR 124, qualification réelle toujours insuffisante à 67/80 ; dictées et relecture humaines attendues.

## 2026-11-13, Codex, F5 : vérification intégrée et PR en brouillon

Vérifié sur `ebb8dea` : types, lint (quatre avertissements hérités), 1 945 tests web / 123 fichiers, 284 tests domaine, 243 mobile, 247 jeu, 90 mascotte et design réussis. Huit parcours navigateur IA simulés rejoués après intégration F3/F1 ; le parcours OpenAI réel est décrit ci-dessous sur `937b130`. La dernière garde sur les tours omis passe son test de reprise et de refus, sans qualification supplémentaire du corpus revendiquée. Les 80 réponses du passage réel à 67/80 sont disponibles dans un document HTML de relecture local, hors dépôt public.
F5 reste en brouillon : seuil de 95 % non atteint, catalogue et dictées humaines non validés. Aucun changement de modèle ni ouverture des inscriptions.

## 2026-11-13, Codex, F5 : parcours navigateur OpenAI réel

Éprouvé le 13 novembre sur serveur local isolé, commit `937b130`, modèle configuré `gpt-4.1-mini` : exercice inconnu → question nommée → création privée relue → reprise → brouillon → publication séparée → lecture athlète. Prescription conservée : trois séries de cinq, repos 60 s, aucune charge. Aucun résultat prestataire ni proposition injecté ; seules les données de comptes fictifs et leur vérification d’e-mail sont préparées. Capture de l’athlète relue ; axe sans violation. Un premier essai avait une assertion erronée sur le nom du champ `rest_s` ; correction et rejeu complet réussis, 1/1 en 45 s build compris. Ce n’est ni une dictée humaine ni une recette sur téléphone.
Corpus réel sur cette version : 67/80, aucune erreur critique acceptée selon le correcteur, seuil toujours non atteint. Ajout suivant : refus d’un circuit dont les tours explicites ont disparu, avec une reprise technique bornée. Contrôles d’intégration et PR F5 en préparation. Fusion de la branche F3 intégrée ; journaux conservés et deux lignes périmées du tableau fondateur corrigées (expéditeur et webhook Resend).

## 2026-11-13, Codex, F3 — relecture humaine et annotations locales

Le fondateur se charge de la relecture technique des 150 textes ; il ne les a pas encore approuvés. Générateur reproductible `exercise:review` : document autonome, recherche/famille/état, remarques par fiche, conservation locale et export JSON avec empreintes du catalogue et de chaque fiche. Un contenu modifié revient à « À relire » sans perdre les remarques ; stockage corrompu préservé et erreur annoncée. Aucun statut saisi ne modifie l’application, aucun visuel n’est validé par cette relecture.
Vérifié : parcours local navigateur, 150 fiches, persistance après rechargement, filtres, export, avis périmé et stockage illisible ; neuf combinaisons thème/taille, mouvement réduit, zéro violation axe ni débordement. Premier passage : titre de niveau manquant corrigé puis recette entièrement rejouée. Aucun écran applicatif modifié ; recette des guides applicatifs déjà consignée ci-dessous. Types, lint (quatre avertissements hérités), design et suites complètes réussis sous Node 22/pnpm 10 : 1 920 tests web, 270 domaine, 243 mobile, 247 jeu et 90 mascotte. La suite E2E applicative complète n’est pas rejouée pour cet outil autonome sans changement du produit.
Android : D-U-N-S déclaré « à obtenir » par le fondateur ; recherche officielle en attente de sa connexion Apple. Aucun numéro supposé, compte Play non créé.
Suite : recevoir la relecture, corriger les fiches puis produire et faire valider les illustrations séparément. Les fichiers et exports nominatifs restent dans `.local`, ignoré par Git.

## 2026-11-13, Codex, F3 — régression navigateur du catalogue

Vérifié sous Node 22/pnpm 10 : suite web complète 223 réussis, 20 ignorés, un délai dépassé sur la première connexion à froid ; parcours d’absence repris seul avec le seuil original, réussi. Total : 224 parcours ordinaires distincts réussis, puis quatre parcours IA dédiés avec prestataire simulé. Les deux parcours de guides vérifient également les trois thèmes aux largeurs 390/768/1440, axe et mouvement réduit. Types, lint (quatre avertissements préexistants), tests des paquets et design restent verts sur le code F3.
Limites : les 150 fiches restent à faire valider par un coach compétent, les illustrations ne sont pas produites. Aucune approbation technique humaine n’est déduite des tests. PR préparée en brouillon ; aucune fusion F3 autorisée à ce stade.


## 2026-11-13, Codex, F5 : génération ordonnée et qualification non acquise

Codé : contrat prestataire en arbre exercice/récupération/répétition ; les références et la projection compatible sont calculées côté serveur. Les tours absents de la consigne sont refusés ; une citation sans attache ne permet plus de conserver silencieusement une séance amputée. Reconnaissance des flexions grammaticales sans effacer direction, hauteur ou matériel, collisions d’alias conservées. Aucun modèle de production remplacé.
Vérifié : 1 924 tests web, 283 domaine, 243 mobile, 247 jeu et 90 mascotte réussis sous Node 22/pnpm 10 ; types verts. 224 parcours navigateur ordinaires, puis huit IA simulés réussis. Captures proposition relues en Tartan/390, sombre/768 et clair/1440 ; matrices axe, débordement et mouvement réduit dans les tests. Une relance unitaire a été invalidée par deux resets concurrents de la même base ; relance complète séquentielle verte, ne pas lancer deux suites web sur tartan_test.
OpenAI réel : après le premier réglage, 53/80, 54/80 et 56/80, sans cas critique accepté selon le correcteur. Comparaison en arbre : GPT-4.1, un passage, 66/80 ; GPT-5.5, un passage, 65/80. Les attendus restent figés ; certains cas exigent une séance malgré un nom ou une charge ambiguë et nécessitent une relecture humaine, sans reclassement opportuniste. Recette navigateur réelle séparée en préparation ; ni ces essais ni les tests simulés ne qualifient les dictées humaines.
Suite : terminer la recette réelle, comparer sur la même version, faire relire le corpus et les propositions ; ne pas ouvrir le mode proposition sans approbation du catalogue.

## 2026-11-13, Codex, F1 : rebond et plainte Resend reçus

Éprouvé sur le prestataire réel, production `88d76e2` : deux gabarits de bienvenue à données fictives envoyés depuis la console aux adresses officielles de simulation Resend, une pour le rebond définitif, une pour la plainte. Tableau des webhooks : deux succès ; détail du rebond HTTP 200 en une tentative. Contrôle SQL ciblé en lecture seule : une empreinte pour chaque adresse synthétique, motifs `bounce` et `complaint` attendus. Aucun compte de passage créé en production et aucun message envoyé à un destinataire humain pour ce contrôle. Capture de preuve conservée localement hors dépôt. Ce test prouve la réception et la mise en liste de blocage ; les messageries Outlook/iCloud restent à éprouver.

## 2026-11-13, Codex, F5 : qualification réelle et corrections ciblées

Premier corpus figé exécuté trois fois avec OpenAI réel : 49/80, 49/80 et 47/80. Le correcteur assimilait un même exercice défini deux fois à une substitution : classement corrigé, résultats recalculés sans nouvel appel dans un rapport distinct ; aucun cas critique accepté selon ces contrôles, mais les défauts de structure et quantités restent comptés. Ces scores sont insuffisants. Le corpus devient une régression après ce réglage ; aucune validation humaine ni dictée physique n’est revendiquée.
Codé : matériel de proposition filtré avant sélection des candidats, revalidation serveur, charge nulle imposée dans le schéma, explication générée distinguée d’une citation en mode proposition. Les choix explicites de fiches lèvent seulement l’alias concerné et sont conservés ; les listes d’alias restent bornées. Une substitution détectée peut demander une clarification avec le nom inconnu, dans la limite globale de deux appels et 100 secondes pour la même opération. Tests ciblés, types et règles métier vérifiés ; régression complète et nouveau passage réel en cours.
Décisions reçues : le fondateur relira les 150 guides ; ce n’est pas encore leur approbation. D-U-N-S à récupérer : procédure du compte Play organisation préparée, fiche de l’entreprise retrouvée sans numéro visible ; aucune demande externe, souscription ou création de compte Play effectuée.


## 2026-11-13, Codex, F5 en cours et recette réelle Mux/Resend

En cours : `feat/planner-resolution`, depuis F3 ; corpus indépendant de 80 cas figé dans le commit `2f2daba` avant le réglage. Deux modes, résolution explicite avec création privée et reprise idempotente, sélection de candidats, circuits partagés avec le constructeur et charges par occurrence. Aucune publication automatique. La proposition spontanée reste bloquée tant que le catalogue commun n'a pas été approuvé techniquement ; les essais du prestataire avec catalogue fictif ne lèvent pas ce verrou.
Vérifié : six parcours navigateur F5 avec prestataire simulé ; création après réponse perdue sans doublon, précisions conservées, circuit modifiable et charges prévisualisées. Appels OpenAI réels : schéma `oneOf` refusé, projection en `anyOf` des unions discriminées corrigée puis testée ; répétition technique bornée à deux appels au plus. Régression historique 58/60, zéro date fausse/charge inventée sur ce passage ; échecs de séries et repos conservés. Le corpus de 80 cas est en cours de mesure, pas encore qualifié.
Exploitation : PR 118 puis 122 fusionnées sur autorisation ; production `88d76e2` vérifiée, webhook Resend activé après le filtre. Les accès Mux Preview autorisés sont installés seulement en Preview. Une première copie du secret de webhook était masquée : corrigée depuis le prestataire ; les événements ont ensuite été rejoués et le premier asset est devenu disponible. Deuxième upload, lecture effective, annotation coach, réponse athlète, partage et révocation éprouvés sur un clip synthétique. Refus inter-athlètes et inter-espaces vérifiés. Fichier temporaire des secrets Mux supprimé ; aucun secret dans Git.
Limites : lecture signée déjà délivrée valable jusqu'à une heure ; aucun téléphone physique, réseau dégradé, suppression Mux ni paiement réel éprouvé. Les inscriptions et le classement restent fermés. Ne pas relancer la graine Preview : le fichier de mot de passe local serait renouvelé alors que les comptes déjà présents sont ignorés.
Suite : terminer F5, relever ses limites sans modifier les attendus figés ; intégrer 119–121 après CI verte, puis poursuivre illustrations/relecture coach, recette web et native.


## 2026-11-13, Codex, F3 : catalogue éditorial et diffusion des guides

En cours : `feat/exercise-catalog-guides`, depuis F6. 150 fiches rédigées, neuf familles, synonymes et conventions explicites ; aucune fiche déclarée validée. Migration additive pour origine/version/guide. Les 55 copies initiales conservent leurs identifiants et prescriptions ; seules les copies anciennes intactes héritent d'un guide. Un exercice personnalisé ne conserve pas une démonstration devenue incohérente. Les 24 anciennes références vidéo restent présentes et hors du total des 150.
Codé : recherche par famille, guide dans la fiche et dans la séance attribuée/mode séance, copie figée à la publication ; cache des futurs SVG locaux versionnés. Aucun média technique approuvé pour le moment : l'interface annonce les illustrations en préparation au lieu de charger des liens absents.
Vérifié : Node 22/pnpm 10, 1 900 tests web, 270 domaine, 243 mobile, 247 jeu et 90 mascotte réussis ; types/lint/design verts (quatre avertissements anciens). Premier parcours navigateur : bibliothèque et séance passent les matrices visuelles ; deux erreurs du nouveau test corrigées (texte présent deux fois, route de lecture unitaire inexistante). Rejeu ciblé et régression complète en cours. Document HTML local de relecture éditoriale généré, non publié.
Exploitation : PR 117 fusionnée et déployée ; fusions 118–120 autorisées toujours en cours. Le fondateur autorise également 121/122 et le webhook Resend filtré. Après sa passkey, test de bienvenue envoyé depuis la production et reçu sur Gmail le 13 novembre à 16 h 08 : SPF/DKIM/DMARC PASS, onglet Promotions. Cartes de sources Sentry présentes pour le déploiement, deux archives de 182/2 400 fichiers. Gmail connecteur nécessite une reconnexion : preuve lue dans sa session Chrome. Console : inscriptions et classement fermés, une seule passkey ; secours encore à prévoir avant retrait du bootstrap.
Suite : finir visuels et validation coach ; figer le corpus indépendant F5 avant réglage du nouveau planificateur ; vérifier les prestataires réels sans assimiler les simulations à des preuves.

## 2026-11-13, Codex, F6 : vidéo collaborative et preuves d’exploitation

En cours : `feat/collaborative-video`, empilée sur F4. Migration additive : identifiant de requête et génération d’upload, réservation de quota, groupes choisis, revue coach et réponses d’annotation. Upload athlète lié côté serveur à son identité, privé par défaut ; séance/exercice vérifiés avant création et renouvellement. Reprises idempotentes, quotas communs aux coachs/athlètes/démonstrations, webhooks tardifs et orphelins, filtre des groupes et retrait d’accès. Interface web : filmer/importer, contexte séance, filtres/pagination, réponses horodatées, revue et partage volontaire avec confirmation et avertissement sur les URL signées valables une heure. Aucun média personnel rendu commun automatiquement.
Vérifié : tous les tests unitaires passent sous Node 22/pnpm 10 : 1 896 web, 267 domaine, 243 mobile, 247 jeu et 90 mascotte. Types/lint/design verts (quatre avertissements anciens). Quatre parcours vidéo ciblés passent sur build de production avec Mux simulé ; régression navigateur complète : 221 réussis, 20 ignorés, un échec ancien de matrice. Reprise ciblée : neuf réussis et un ignoré, dont les quatre IA simulés et la matrice corrigée. La matrice HTTP attendait encore un refus d’upload athlète : attente mise à jour. Les sept tests de collaboration passent après ajout du refus de renouvellement d’une séance désattribuée. Captures : la grille desktop débordait dans le conteneur étroit de l’athlète ; corrigée en trois colonnes adaptatives. Nouvelle vérification du débordement interne et relecture des captures ; deux parcours vidéo rejoués verts, chacun avec 27 combinaisons de trois écrans, thèmes et tailles, mouvement réduit et axe. Non éprouvé : upload/lecture Mux réels, réseau terrain et applications natives ; les captures avec Mux simulé ne démontrent pas la lecture réelle.
Exploitation : sauvegarde Blob privée téléchargée, déchiffrée, restaurée localement en 0,89 s ; 83 tables/48 migrations, puis F2/F6 appliquées en 1,22 s sans écart des comptes sur cinq tables centrales. Base isolée supprimée après contrôle ; accès Blob réservé au projet de maintenance, aucun secret suivi. Neon : organisation dédiée créée et seul Tartan transféré pour isoler les autres projets ; souscription Launch terminée par le fondateur dans Stripe Link, rétention sept jours et production protégée relues via API. Production et Preview saines après transfert. La fenêtre historique se constitue à partir de l’activation. Mux : variable de production `MUX_VIDEO_LIMIT=0` posée, quotas commerciaux conservés, effet au prochain déploiement. Resend : webhook des trois événements créé mais désactivé ; secret stocké sur Vercel, en attente de déploiement et de filtrage de l’expéditeur car le compte sert d’autres applications. Sentry : accès API de lecture local autorisé par le fondateur ; événement technique reçu et règle d’alerte déclenchée ; réception Gmail vérifiée à 13 h 55 UTC, puis notification d’essai Sentry reçue à 13 h 57 UTC. Aucun champ utilisateur renseigné dans l’événement de contrôle. Traces d’un ancien incident serveur minifiées : cartes de sources à corriger. Anciens artefacts GitHub non supprimés, aucune fusion ni ouverture des inscriptions.
Suite : terminer la recette F6 et sa PR, poursuivre F1 (Resend, sources/alertes Sentry, SSL), puis F3 et F5. Ne pas lancer deux suites navigateur sur le même dossier ni régénérer un client Prisma d’un autre schéma pendant les scénarios qui exécutent les scripts de démonstration.

## 2026-11-13, Codex, F4 : constructeur et réalisation des circuits

En cours : `feat/session-builder-sequences`, empilée sur F2. Cartes de répétition à deux niveaux, récupérations, duplication, déplacement au clavier, dissociation, annulation du contenu, phases communes club/autonomie. Aperçu et mode séance utilisent les occurrences du domaine ; le dernier tour n'ajoute pas de repos implicite. Tous les textes des deux écrans touchés sortis de la base de suppressions lint.
Codé : cache local sept jours par compte/espace/séance, reprise explicite, verrou de navigateur/révision contre les onglets concurrents, création interrompue signalée, nettoyage à la déconnexion. Adaptations par occurrence conservées lors de l'édition.
Vérifié : suite unitaire complète verte (267 domaine, 1 886 web, 243 mobile, autres paquets inclus), types/lint/design ; cinq parcours ciblés passent en développement (construction/reprise, réalisation athlète, conflit serveur, conflit local et réponse perdue), neuf contrôles axe/largeur et mouvement réduit. Le cas de réponse perdue bloque aussi un second envoi depuis l’écran courant ; les champs sont désactivés pendant l’enregistrement. Captures relues à 390, 768 et 1440 px dans les thèmes. Régression production : 217 réussis, 20 ignorés et trois échecs initiaux. Un formulaire neuf sauvegardait une copie vide : état initial corrigé ; deux parcours publication passent désormais. Le troisième échec venait du client Prisma F6 régénéré pendant un scénario qui lance un script depuis les sources : schéma F4 rétabli pour la reprise. Reprise isolée : 15 réussis et un ignoré, dont les trois échecs, les huit parcours circuits et quatre parcours IA simulés. Soit 220 parcours ordinaires distincts et quatre IA vérifiés. Non vérifié : prestataires réels, clients natifs et terrain réel.
Exploitation indépendante : branche stable `preview` créée depuis le main publié, domaine `preview.tartan.coach` attaché à cette branche, deux URL applicatives dédiées posées et déploiement Preview READY. CNAME ajouté chez OVH sur autorisation explicite, cible vérifiée par Vercel, certificat émis et HTTPS opérationnel. Exception de protection limitée au domaine stable pour les clients natifs : `/api/v1/me` sans session retourne 401 ; l’adresse de déploiement Vercel conserve sa protection (302 SSO). Neon CLI authentifiée : douze migrations Preview en retard appliquées, 49/49 à jour. Aucune migration en production. Connexion applicative native encore à éprouver ; restauration Neon toujours six heures et production non protégée. Restauration Blob non effectuée : clé age locale présente, accès au fichier privé encore à établir.
## 2026-11-13, Codex, intégration F2 après exploitation

Vérifié : CI qualité et native vertes au commit `3f32fd0`, Android compilé, treize parcours Maestro puis suppression du compte jetable réussis. Le correctif de saisie conserve les assertions de majorité. Aucun appareil physique testé.
Intégration : `main` mis à jour après la fusion autorisée de la PR 122 ; les deux entrées concurrentes du journal sont conservées. Nouvelle CI requise pour ce commit de fusion avant la PR 119, accord du fondateur déjà reçu.

## 2026-11-13, Codex, F2 : diagnostic de la saisie Maestro avant fusion

Les deux exécutions natives de la PR 119 échouent avant l'écran d'âge : le pilote a saisi seulement une partie de l'adresse et aucun mot de passe. Les traces confirment les valeurs de test complètes envoyées au pilote, les captures montrent la saisie incomplète. Le sous-parcours saisit désormais caractère par caractère et relit l'adresse exacte avant de continuer ; les assertions de majorité restent inchangées. `pasteText` n'aurait rien corrigé : il appelle la même méthode `inputText` dans Maestro. Vérification native à reprendre en CI ; aucune preuve de téléphone physique. Branche F2 mise à jour avec `main` après fusion autorisée de 118.

## 2026-11-13, Codex, F2 : contrats de circuits et compatibilité

Codé : `feat/session-sequences`, empilée sur F1 ; exercices, récupérations et répétitions bornées à deux niveaux, expansion A/B/A/B, références d'occurrences, adaptations source/occurrence, conservation des charges figées, modèles V2 et garde contre les anciens éditeurs. Migration nullable seulement, appliquée aux bases locales de test ; pas en production.
Vérifié : types, lint (quatre avertissements existants), design, 265 tests domaine et 1 884 tests web ; les 243 tests mobile restent verts. La suite initiale a détecté le rejet d'un brouillon historique vide : validation V2 restreinte et suite web intégralement rejouée avec succès. Parcours navigateur sur build de production : 208 réussis, 20 ignorés selon les drapeaux, quatre échecs de traces causés par deux suites partageant le même dossier de résultats ; les quatre concernés et quatre parcours terrain associés passent ensuite (8/8), avec sortie isolée. Aucun échec applicatif restant observé.
Limites : aucun écran de construction ni minuteur encore raccordé, aucun essai prestataire ou téléphone réel. La lecture API fournit déjà l'ordre développé ; les modèles V2 exigent la capacité `structureVersion=2`.
Suite : F3 catalogue, F4 constructeur et mode séance, F5 planificateur puis F9 natif. Ne pas déclarer F2 éprouvé avant ces consommateurs.

## 2026-11-13, Codex, F1 : isolation des rebonds et instrumentation

Codé sur `fix/operational-delivery`, basée sur les sauvegardes privées : le webhook Resend vérifie l'expéditeur exact, ignore les autres applications et accepte une liste explicite d'anciens expéditeurs pour les événements retardés. PostgreSQL explicite `verify-full` pour conserver le contrôle du certificat et du nom d'hôte lors de l'évolution de node-postgres. Sentry : hooks de tracing ESM désactivés puisque le tracing est déjà coupé ; capture d'erreurs conservée.
Vérifié : 25 tests ciblés réussis ; types/lint/design verts (quatre avertissements existants). Matrice HTTP sur build de production : un parcours réussi, un ignoré car doublon mobile. Suite unitaire complète rejouée après stabilisation : 1 900 web, 257 domaine, 243 mobile, 247 jeu et 90 mascotte réussis. Une première exécution chevauchait l’ajout de la compatibilité des anciens expéditeurs et avait chargé des versions différentes du handler et du test ; reprise ciblée puis complète verte. Pas de nouvelle recette exhaustive des écrans sur ce lot technique.
Exploitation : domaine d'envoi Tartan vérifié chez Resend (DKIM et SPF), trois enregistrements ajoutés chez OVH sur autorisation du fondateur. Clé dédiée à l’envoi créée après autorisation et saisie du code par le fondateur ; clé, expéditeur et adresse précédente installés dans Vercel production. Jeton Sentry de compilation `org:ci` autorisé, créé et posé sur Vercel avec organisation/projet. Effet au prochain déploiement ; envoi réel et lecture des sources encore à prouver. Paire VAPID Preview régénérée séparément, redéploiement lancé ; production inchangée. Aucune donnée réelle ni secret dans le dépôt.
Fusions : autorisation explicite reçue pour les PR 117–120. PR 116 déjà fusionnée entre-temps : ses e-mails et son journal sont conservés dans les quatre branches, avec relance de CI. PR 121 vidéo séparée, aucune autorisation de fusion pour celle-ci. Inscriptions fermées.

## 2026-11-13, Codex, F1 : sauvegarde privée obligatoire et main protégé

Fait : protection de `main` activée puis relue via API (PR, contrôle `quality`, branche à jour, discussions résolues, pas de force-push ni suppression, administrateurs inclus). Zéro approbateur imposé par GitHub pour éviter l'auto-approbation impossible du compte unique ; l'accord du fondateur avant fusion reste la règle.
Codé : `fix/private-backup-required`, empilée sur F0/PR 117 ; secret Blob obligatoire avant export, aucun upload-artifact ni repli public, échec explicite. La PR 115 de l'autre agent améliore la relecture Blob : son script et ses tests ne sont pas repris ni écrasés.
Vérifié : actionlint et exécution du contrôle avec jeton absent/fictif, diff propre ; types/lint/tests/design déjà verts sur la base inchangée, aucun parcours modifié. Non vérifié : workflow déployé, réception d'alerte et restauration Blob.
Blocage externe : Neon MCP refuse l'authentification (401), reconnexion demandée ; CLI installée ancienne. Suite : poursuivre F1 après reconnexion et F2 indépendamment.

## 2026-11-13, Codex, F0 : finalisation autorisée et preuves réconciliées

Fait : plan F0–F9 intégré au plan web existant ; décisions produit et exception de cartes imbriquées ; audit daté dans ETAT, états Android/Blob/Stripe et tests réconciliés, compte Play organisation, réserves médiateur/clé conservées sans les déclarer résolues.
En cours : `docs/completion-baseline`, depuis `main` à jour (`3bb8099`), aucune branche d'un autre agent reprise. Node 22.23.5/pnpm 10.34.9 verrouillés ; types, lint (quatre avertissements existants), tous les tests et design passent. E2E non relancé : aucun parcours modifié.
À savoir : l'audit précédent avait utilisé Node 24 ; ses tests verts ne sont pas une preuve sous le runtime prescrit. Aucun écran, paiement ou téléphone réel ajouté à la preuve par cette documentation.
Suite : F1 exploitation puis F2 contrats, en conservant une branche/PR par lot.
Intégration : PR 116 des e-mails conservée intégralement lors de la mise à jour avec `main` ; les deux passations du journal sont gardées. Fusions 117 à 120 autorisées explicitement par le fondateur le 13 novembre, uniquement après contrôles verts.

## 2026-11-13, Claude, e-mails dans le mélange Tartan

Fait : à la demande du fondateur, le gabarit commun (`apps/web/emails/layout.tsx`) passe à la piste en fond, aux deux lignes blanches, à une carte encre au texte blanc, à l'action et aux liens citron, et à une ligne blanche d'arrivée avant le pied de page sur la piste. Encadré `Highlight` (encre relevée, bordure citron) pour les échéances ; liens de désinscription en `FooterLink`, y compris le repli des notifications (PR `feat/emails-stade`).
Vérifié : les 29 e-mails du catalogue rendus et regardés à 600 et 375 px. Non vérifié : rendu dans Gmail, Outlook et Apple Mail réels (F1).

## 2026-11-13, Claude, gestes sur les comptes : sauvegarde éprouvée, M1, variable Apple

Fait : copie de production envoyée dans le store Vercel Blob privé (créé par le fondateur), désormais relue depuis le store et comparée par empreinte après chaque envoi ; `APPLE_APP_BUNDLE_IDENTIFIER=coach.tartan.app` posé sur Vercel (production) ; `AI_TRANSCRIPTION_MODEL` absent, donc `gpt-transcribe` ; premier build EAS Android de production réussi (1.1.0, build 3) (PR `feat/sauvegarde-relecture`).
À savoir : relier un second store Blob au projet `tartan` écraserait `BLOB_READ_WRITE_TOKEN` des images ; le store des sauvegardes n'est relié à aucun projet. Un projet Vercel `tartan-sauvegardes` créé par erreur a été supprimé aussitôt.
Reste : restauration chronométrée depuis le store (le jeton n'existe qu'en secret GitHub), retrait des anciens artefacts, envoi sur Google Play.

## 2026-11-13, Claude, l'agent peut agir sur les comptes du fondateur

Fait : à la demande écrite du fondateur, `AGENTS.md` autorise l'agent à créer des ressources et à poser des secrets sur Vercel, GitHub, EAS et Neon, sans jamais les afficher (PR `docs/regles-agent`). Restent au fondateur : paiements et offres payantes, engagements légaux, ouverture des inscriptions et du classement, essais sur ses téléphones. Le dépôt public, la garde `assertEnvIsolation` et l'interdiction d'essayer sur la production avec des comptes de passage ne changent pas.

## 2026-11-13, Claude, M3 (captures Android et iOS) et A13 (sauvegardes vers Vercel Blob)

Fait : `pnpm captures --android` (émulateur Pixel 1080 × 1920, image `android-36;default;arm64-v8a`, mode démo de la barre d'état) ; huit captures Android et les huit iOS de l'App Store, analyse vidéo comprise, sur le clip Pexels autorisé par le fondateur (`apps/web/public/dev/`, ignoré par Git). La variante de développement autorise le HTTP en clair sur Android, pour le serveur local. Sauvegardes : `apps/web/scripts/sauvegarde-blob.mjs` (envoyer, purger, lister, télécharger) branché dans `sauvegarde.yml` derrière le secret `BACKUP_BLOB_TOKEN` (PR `feat/captures-android`).
Trouvé : toute lecture vidéo fermait l'app Android (media3 1.9 tiré par CameraX, `expo-video` compilé contre 1.8). Patch d'`expo-video` et compilation depuis les sources : voir `docs/plans/android.md`. La CI mobile ne lit aucune vidéo sur Android : ce défaut n'y était pas visible.
Reste au fondateur : créer le store Blob privé et poser le secret (procédure dans `docs/exploitation/sauvegarde.md`), puis une restauration chronométrée.

## 2026-11-13, Claude, T07 sur simulateur, et le refus d'enregistrement visible

Fait : le job `maestro` crée un compte jetable (athlète de l'espace de démonstration), lance `.maestro/destructive/account-delete.yml` après les treize flux, puis vérifie en base que le compte a disparu. Le flux suit les gestes sûrs d'iOS (attente du clavier, connexion par `flows/_sign-in.yml`). Dans l'éditeur de séries du mobile, le message d'enregistrement passe au-dessus du bouton : après un refus, le bandeau de synchronisation pousse l'écran vers le bas et le message, sous le bouton, sortait de l'écran (PR `test/maestro-suppression`).
À savoir : le dossier `destructive` reste hors de `maestro test .maestro` ; ne jamais y passer un compte de démonstration.

## 2026-11-13, Claude, T24 : planificateur, capture et synchronisation dans les parcours natifs

Fait : prestataire factice `src/server/ai/fake-provider.ts`, choisi par le service de proposition quand `AI_PLANNER_FAKE_PROVIDER=true`, jamais sur Vercel, et refusé en production par `assertEnvIsolation`. Flux Maestro `coach-planner` : accord, destinataires, consigne relue, proposition, relecture, brouillon créé. Le job `maestro` ouvre le planificateur dans l'espace de démonstration (offre pilote, drapeau IA) (PR `test/maestro-planificateur`).
Vérifié : `tests/ai-proposal.test.ts` (la proposition factice passe la validation réelle et n'écrit aucune séance), `tests/env-isolation.test.ts`.
Aussi : `coach-capture` (écran de capture ouvert depuis les vidéos du coach) et `sync-review` (le coach réenregistre la séance pendant que l'athlète saisit ses séries détaillées, `scripts/bump-session.js` ; le serveur refuse, l'app garde la saisie et mène à « Vérifier mes saisies »). Les flux passent dans un ordre fixé (`config.yaml`).
À savoir : seules les séries détaillées portent la version de la séance, la validation simple ne crée pas de conflit. Le message de refus s'affiche sous le bouton, et le bandeau de synchronisation qui apparaît en haut le pousse hors de l'écran : le flux descend jusqu'à lui.

## 2026-11-13, Claude, M2 vert, et ce qui reste du plan

Fait : le job `maestro` passe (PR `test/maestro-ci`, fusionnée) : dix flux natifs sur simulateur iOS à chaque PR mobile. Les causes trouvées en chemin, à garder en tête : Xcode 26 exigé par Expo SDK 55 ; signature ad hoc obligatoire (sinon pas de trousseau, donc pas de session) ; clavier d'adresse d'iOS que Maestro ne ferme pas (toucher le titre) ; premières lettres perdues si l'on tape pendant l'ouverture du clavier (`waitForAnimationToEnd`) ; fuseau Europe/Paris, sinon la séance du jour disparaît autour de minuit ; serveur à chauffer avant le premier flux ; build en arm64 seul (15 minutes au lieu de 48).
En production depuis le 12 novembre : film ralenti et échauffement au saut en hauteur sur la page d'accueil (PR 107), révocation Apple de la connexion native (M6, PR 109).
Reste, à décider ou à fournir par le fondateur : M3 (deux téléchargements : image Android, clip Pexels), le faux prestataire IA côté serveur pour le flux natif du planificateur, A13 (stockage des sauvegardes, F15 ; offre Sentry), les lignes F du tableau « Fondateur ».

## 2026-11-12, Claude, M2 et T09 : Maestro sur simulateur en CI

Fait : job `maestro` dans `.github/workflows/mobile-native.yml`, sur macOS : Postgres installé par Homebrew, migrations, graine de démonstration, compte sans date de naissance pour `age-gate`, serveur web local (`next start`), app de développement compilée pour le simulateur iOS (`TartanDev`, en Release, l'API sur `http://localhost:3000`), puis `maestro test .maestro`. Les flux de l'athlète n'ont plus de `runFlow: when` ; `coach-tracking` ouvre la séance du jour et enregistre l'appel (PR `test/maestro-ci`).
À savoir : aucun secret, tout naît et meurt dans le job. En local, CocoaPods exige `LANG=en_US.UTF-8`. Les artefacts du job (rapport JUnit, captures de Maestro, journal du serveur) aident à comprendre un échec.
Vérifié en local : l'app de développement se compile pour le simulateur (Xcode 26.2), s'ouvre sur l'écran de connexion et joint le serveur local ; la graine et le compte sans date de naissance se créent comme dans le job.
Cause des échecs : compilée avec `CODE_SIGNING_ALLOWED=NO`, l'app n'a pas accès au trousseau, où `SecureStore` range la session ; la connexion et le lien de retour échouaient pour cette seule raison. Le job signe désormais en ad hoc (`CODE_SIGN_IDENTITY=-`), sans compte Apple.
Éprouvé sur simulateur, avec l'app signée en ad hoc et le serveur local : le lien de retour (`tartan-dev://callback?cookie=…`) ouvre la session du coach, puis celui de l'athlète fait passer l'app à son accueil, sans rien garder du coach (M4).
Suite conseillée : les flux de T24, puis ceux de M4 (changement de compte) et M5 (vidéo juste encodée).

## 2026-11-12, Claude, page d'accueil : film ralenti, échauffement au saut en hauteur

Fait : à la demande du fondateur, le film des disciplines passe à 750svh sur téléphone et 1000svh sur ordinateur (au lieu de 300 et 450svh). L'échauffement de la page d'accueil devient le saut en hauteur. Pour cette épreuve : la barre et les poteaux montent à chaque hauteur, l'arc du sauteur aussi ; ralentis à l'appel, au franchissement et à la réception ; confettis et hauteur affichée pour une barre franchie. Le moteur de partie accepte un `timeScale` par épreuve, qui ne change que l'affichage (PR `feat/landing-hauteur`).
Vérifié : `tests/high-jump-scene.test.ts` ; partie jouée dans le build de production avec des appuis minutés, regardée en captures à 390, 768 et 1440 px et en mouvement réduit (pas de confettis).
À savoir : le ralenti allonge le temps réel d'une partie, jamais le nombre de pas : le rejeu du serveur et le contrôle de cadence du classement ne bougent pas. Les sons (applaudissements) restent hors périmètre : le jeu n'a pas de son.

## 2026-11-12, Claude, M6 : révocation Apple pour la connexion native

Fait : l'app iOS envoie le code d'autorisation d'Apple à `POST /api/v1/me/apple-authorization`. Le serveur l'échange auprès d'Apple avec le bundle de l'app (`APPLE_APP_BUNDLE_IDENTIFIER`), vérifie que le sujet du jeton est le compte Apple relié, puis garde le jeton de rafraîchissement et l'identifiant qui l'a délivré (colonne additive `account.apple_client_id`). La suppression du compte révoque avec cet identifiant (PR `feat/apple-revocation`).
Vérifié : `tests/auth-social.test.ts` (échange, révocation avec le bundle, autre compte Apple refusé, compte sans Apple, configuration absente, panne d'Apple), ligne de la matrice d'accès.
Non vérifié : un échange réel avec Apple. La connexion Apple reste éteinte ; le jour où elle s'allume, poser `APPLE_APP_BUNDLE_IDENTIFIER` sur Vercel.

## 2026-11-12, Claude, fin de la file du 12 novembre : bilan

Fait et fusionné : B5 à B9, C1 à C3, J2 à J10, retouche du film et des tapis, puis les tests T10 à T22 et T25, M1, M4, M5, P1 (une PR par lot, empilées pour éviter les conflits de `ETAT.md` et `JOURNAL.md`). T23 et T24 sont documentés comme hors CI, dans `docs/tests/automatisation.md` (PR `docs/tests-hors-ci`).
À savoir : les PR de tests touchent toutes la ligne T-suite d'`ETAT.md` et le haut du journal. Les empiler (chaque branche part de la précédente) évite de relancer une CI par conflit. Le job `quality` a désormais 60 minutes : les parcours en prennent près de 30.
Reste au fondateur : ouvrir le classement du jeu dans `/admin/configuration` s'il le souhaite ; lancer un build EAS de production (M1) ; la clé OpenAI (F6), puis une vraie dictée et `eval:planner --live` (T23) ; vérifier `AI_TRANSCRIPTION_MODEL` sur Vercel ; installer Maestro pour T24 ; les autres lignes du tableau « Fondateur ».
Suite conseillée : M2 et T09 (Maestro en CI), M3 (captures), M6 si la connexion Apple doit ouvrir.

## 2026-11-12, Claude, M4 : changement de compte par lien magique sur mobile

Fait : l'écran de retour (`app/(auth)/callback.tsx`) vidait le cache avant de poser le nouveau cookie. Un écran encore monté de l'ancien compte pouvait donc relire `/me` avec l'ancien cookie, et l'aiguillage retrouvait l'ancien rôle, ce que le simulateur avait montré le 9 novembre. Le cookie était aussi fusionné avec l'ancien, et l'espace actif mémorisé restait celui de l'ancien compte. `src/lib/account-switch.ts` fixe l'ordre : arrêter les requêtes, effacer puis poser le cookie, vider les données et l'espace mémorisé, relire la session, repartir de l'aiguillage (PR `fix/mobile-changement-compte`, empilée sur M5).
Vérifié : deux tests de l'ordre, typecheck du mobile.
Non vérifié : sur simulateur, et pas de flux Maestro dédié (Maestro n'est pas installé sur ce poste). La cause reste donc « probable » tant que l'essai réel n'est pas fait.

## 2026-11-12, Claude, M5 : repli HLS du lecteur mobile

Fait : `apps/mobile/src/lib/playback-source.ts` choisit la source (MP4 d'abord, HLS s'il manque), et `app/video/[id].tsx` repart une fois sur le HLS quand le lecteur échoue sur le MP4, comme le web (PR `feat/mobile-hls-repli`, empilée sur P1).
Vérifié : trois tests de la règle, typecheck du mobile.
Non vérifié : sur un téléphone, une vidéo ouverte juste après l'encodage. Il faut un build de développement et une vidéo Mux réelle.

## 2026-11-12, Claude, P1 : la dictée passe à gpt-transcribe

Fait : `AI_TRANSCRIPTION_MODEL` vaut `gpt-transcribe` par défaut. La requête envoie `languages[]`, `keywords[]` et un `prompt` de contexte court, jamais `language` (PR `feat/gpt-transcribe`). Source : la documentation d'OpenAI, pages « Transcription » et « GPT-Transcribe » (recherche externe du 12 novembre 2026). L'ancien modèle reste accepté jusqu'à son arrêt.
Vérifié : tests du fournisseur de transcription, de l'API et du flux de dictée.
Non vérifié : une vraie dictée. Elle attend la nouvelle clé OpenAI (F6). Le fondateur doit aussi vérifier si `AI_TRANSCRIPTION_MODEL` est défini sur Vercel avec l'ancien nom.

## 2026-11-12, Claude, M1 : l'échec des builds EAS à « Read app config »

Fait : cause trouvée dans le journal du build Android du 9 novembre sur expo.dev : `expo config` échoue sur `app.config.ts` (« Unexpected token '{' »). La configuration importe deux fichiers TypeScript que seule la lecture native de Node savait charger. Correction : `import "tsx/cjs"` en tête de la configuration, et `tsx` en dépendance de développement du mobile (PR `fix/eas-app-config`).
Vérifié : `src/lib/app-config.test.ts` lit la configuration de production avec et sans le TypeScript natif de Node ; il échoue sans la correction.
Non vérifié : un build EAS réel. Il engage le compte du fondateur, qui le lance (commande dans `docs/plans/android.md`).
À savoir : les variables EAS de production ne sont pas en cause (`GOOGLE_SERVICES_JSON` sous forme de texte a été testé localement avec une valeur factice).

## 2026-11-12, Claude, test T20 : fiches de la console

Fait : `apps/web/e2e/admin-console.spec.ts` ouvre aussi `admin/espaces/[id]` et `admin/factures/[id]` (PR `test/console`).
Vérifié : quatre parcours verts en build de production, ordinateur et téléphone.
À savoir : les deux projets créent chacun un espace « Coaching Console » dans la même base. Cibler une ligne par son identifiant, pas par son nom.

## 2026-11-12, Claude, test T19 : les pages sans parcours, avec données

Fait : `apps/web/e2e/filled-pages.spec.ts` (PR `test/pages-donnees`) remplit un compte neuf avec `prisma/demo-fill.ts`, puis visite `/mes-sauts`, une vidéo, `/progres` et `/seances/[id]/charges`.
Vérifié : parcours vert en build de production, projet mobile.
À savoir : le script de démonstration refuse un second remplissage dans la même base. Le parcours ne tourne donc que sur le projet mobile, sans nouvelle tentative. Dans un fichier de parcours, `__dirname` n'existe pas : utiliser `import.meta.dirname`.

## 2026-11-12, Claude, test T18 : centre de notifications, et cloche corrigée

Fait : `apps/web/e2e/notification-center.spec.ts` (PR `test/notifications`). Correction : après « Tout marquer comme lu », la cloche gardait son ancien compteur, car elle ne relisait qu'au changement d'adresse. La liste émet désormais `NOTIFICATIONS_READ_EVENT` après chaque lecture, et la cloche relit.
Vérifié : quatre parcours verts en build de production, ordinateur et téléphone.
Non vérifié : sur un vrai téléphone.

## 2026-11-12, Claude, test T14 : la page abonnement

Fait : `apps/web/e2e/subscription.spec.ts` (PR `test/abonnement`).
Vérifié : quatre parcours verts en build de production, ordinateur et téléphone.
À savoir : le serveur e2e n'a pas de clé Stripe, la vente y est donc coupée, comme en production avant l'ouverture. Le parcours vérifie qu'aucun bouton n'y lance un paiement ; le paiement lui-même reste couvert par T03 en sandbox.

## 2026-11-12, Claude, tests T12 et T13 : invitation nominative et changement d'espace

Fait : `apps/web/e2e/staff-invitation.spec.ts` et `apps/web/e2e/space-switch.spec.ts` (PR `test/espaces`).
Vérifié : quatre parcours verts en build de production, ordinateur et téléphone.
À savoir : un espace neuf est en Découverte, plafonnée à un coach : sans `setOffre(…, "pilot")`, l'invitation d'un coach est refusée par l'offre, en silence pour un test qui attend un toast de succès. Pour un cookie forgé, prendre un espace dont le compte n'est vraiment pas membre.

## 2026-11-12, Claude, test T21 : le worker du site

Fait : `apps/web/tests/service-worker.test.ts` exécute le vrai `public/sw.js` avec `node:vm`, dans un faux contexte de worker (notifications, fenêtres, caches, réseau) (PR `test/worker`).
Vérifié : cinq tests verts : notification, clic, réponse depuis la notification, filtres de `fetch`, repli hors ligne.
À savoir : le worker reste du JavaScript sans module : on le charge tel quel, rien n'est extrait pour le test.

## 2026-11-12, Claude, tests T15, T16 et T17 : gardes d'accès

Fait : `apps/web/tests/access-guards.test.ts` : lien de parrainage `r/[code]`, limiteur de connexion de Better Auth, vérification renforcée de la console (PR `test/garde-acces`). La règle d'activation du limiteur devient la fonction `rateLimitEnabled` de `src/lib/auth.ts`, sans changement de comportement.
Vérifié : dix tests verts. Le test de la console lit les fichiers : une action de `src/features/admin/*.action.ts` qui ne serait pas une `adminAction`, ou une route de `/admin` sans `requireStepUp`, le fait échouer.
Suite conseillée : T12, T13, T14 (parcours e2e), T18 à T21.

## 2026-11-12, Claude, tests T11, T22 et T25 : routes techniques

Fait : `apps/web/tests/technical-routes.test.ts` appelle les vrais handlers de la tâche horaire, de `health`, `live`, `version`, du flux `ical`, ainsi que `manifest`, `robots` et `sitemap` (PR `test/routes-techniques`).
Vérifié : neuf tests verts. Seuls le secret de la tâche, une tâche en panne (`processReferrals`) et une base coupée (`$queryRaw`) sont simulés.
À savoir : le mock de `@/lib/env` étend le vrai environnement, sinon la base de test n'est plus joignable ; ses constantes passent par `vi.hoisted`.
Suite conseillée : T12 à T21.

## 2026-11-12, Claude, tests T10 : la vidéo en HTTP

Fait : `tests/video-http.test.ts` passe par les vrais handlers des routes vidéo, avec une vraie session, Mux seul simulé : création d'une adresse d'envoi, renouvellement d'une adresse expirée, liste du coach, vidéo invisible de l'athlète avant partage, remarque, partage et notification, partage au groupe refusé, remarque retirée ; un coach d'un autre espace ne crée, ne lit ni ne partage rien. `tests/upload-queue.test.ts` fait tourner la vraie file d'envoi du navigateur contre un faux serveur qui suit le protocole reprenable de Mux : envoi en morceaux de 4 Mio, reprise après coupure sans renvoyer ce qui est reçu, adresse expirée renouvelée, refus définitif abandonné, envoi hors ligne gardé (PR `test/video-http`).
À savoir : la fin du traitement par Mux (webhook) est posée en base dans ce test ; elle a son propre test signé, `mux-webhook.test.ts`.
Suite conseillée : T11 et T22.

## 2026-11-12, Claude, lot J3 : classement du jeu, construit et fermé

Fait : trois tables additives (`game_runs`, `game_scores`, `game_bans`). `src/server/game.service.ts`, service public limité à ces tables : le départ d'un essai tire la graine côté serveur et rend un jeton à usage unique (15 min) ; l'envoi consomme le jeton, rejoue le journal des appuis avec `packages/game`, refuse un score impossible (plafond), une partie arrivée plus vite que son horloge (90 % de sa durée), un pseudo filtré (3 à 16 caractères, mots refusés), un appareil banni, et limite le débit par empreinte d'adresse ; une marque nulle n'est pas classée. Classement par épreuve, semaine en cours ou depuis toujours, meilleur score par appareil. Effacement sans compte par l'appareil. Tâche quotidienne : empreintes IP effacées à 30 jours, jetons inutilisés à un jour. Routes `/api/v1/game/runs`, `/scores` (POST et DELETE), `/leaderboard`. Console `/admin/jeu` (masquer, bannir). Réglage « Classement du jeu » dans `/admin/configuration`, fermé par défaut ; sur `/jeu`, rien ne change tant qu'il est fermé (PR `feat/jeu-classement`).
Vérifié : `tests/game-leaderboard.test.ts` (fermé, score classé, jeton rejoué, journal falsifié, partie trop rapide, pseudo refusé, débit, effacement, bannissement, purge), quatre lignes de la matrice d'accès, `e2e/game-page.spec.ts` (classement ouvert : une course réelle classée sous un pseudo, puis effacée), `/admin/jeu` dans le parcours de la console.
À savoir : sur un POST, next-zod-route lit déjà le corps ; les routes le valident donc elles-mêmes (`route.body`). Le rejeu prouve qu'un score découle d'appuis valides, pas qu'un humain a joué. Le fondateur a rapporté le 12 novembre l'accord du juriste ; la politique de confidentialité porte maintenant la mention « Le jeu du site » (données, base, durées, effacement sans compte). Basculer le réglage dans `/admin/configuration` reste son geste.
Suite conseillée : tests T10 à T25.

## 2026-11-12, Claude, lot J4 : aperçu du jeu sur la page d'accueil

Fait : `src/features/landing/warm-up.tsx`, entre la ligne d'arrivée et les questions fréquentes : Inès sur sa ligne de départ, « Jouer au 110 m haies ici », un lien vers `/jeu`. Le clic charge le moteur de partie et le 110 m haies (`import()`), puis la course se joue dans la page (PR `feat/jeu-encart`).
Vérifié : `e2e/landing.spec.ts` lit le contenu de chaque script chargé par la page : aucun ne contient le code de la simulation avant le clic (repère : le message « invalid seed » du noyau), un au moins après ; la course démarre sur la page.
À savoir : pas d'événement d'audience sur mesure (la mesure actuelle ne compte que les pages vues) : l'effet de l'aperçu se lira sur les visites de `/jeu` et de la création d'espace.
Suite conseillée : J3, construit mais éteint.

## 2026-11-12, Claude, lot J10 : combiné

Fait : `packages/game/src/combined.ts` convertit chaque marque en points, par épreuve, sur une droite entière : 0 point à la marque basse (18,00 s aux haies, 3 m en longueur, 9 m au triple, 1,50 m en hauteur, 4 m à la perche, 15 m au disque), 1 000 à la marque haute (13,00 s, 7,50 m, 15 m, 2 m, 5,70 m, 45 m), 1 200 au plus, 0 pour un essai nul. Sur `/jeu`, « Jouer le combiné » charge les six épreuves et les enchaîne, un essai chacune ; le moteur de partie accepte un rappel en fin d'épreuve et remplace « Rejouer » par « Épreuve suivante » (PR `feat/jeu-combine`).
Vérifié : `combined.test.ts` (bornes, sens des épreuves, plafond, total), `e2e/game-page.spec.ts` (une épreuve, ses points, l'épreuve suivante).
À savoir : le barème est celui du jeu, sans rapport avec les tables officielles. Le classement du combiné, comme celui des épreuves, attend J3 (éteint tant que le juriste n'a pas répondu sur le classement public).
Suite conseillée : J4.

## 2026-11-12, Claude, lot J9 : lancer du disque

Fait : `packages/game/src/events/discus.ts`. Tenir l'appui lance la volte : la rotation gagne 1/16° par pas à chaque pas, jusqu'à 6° par pas (720° par seconde). Relâcher lâche le disque dans la direction du bras : dans le secteur (±17°), sa vitesse (230 mm/s par seizième de degré et par pas) donne la distance, angle d'envol fixe à 35° ; hors du secteur, mordu ; au-delà de trois tours, sorti du cercle. Forme du jour ±40 cm ; plafond 47,099 m. Sur `/jeu`, Mehdi rejoue le geste de `packages/mascot` ; un cadran vu de dessus montre le secteur en citron et le bras qui tourne (PR `feat/jeu-disque`).
Vérifié : `discus.test.ts` (rotation, secteur, sortie du cercle, plafond), références et 300 journaux sous Node, Chromium et WebKit, `e2e/game-page.spec.ts` ; volte et mordu regardés à 390 px. Non vérifié : un lancer valable regardé à l'image.
À savoir : les six épreuves sont jouables ; restent le classement (J3), l'aperçu sur la page d'accueil (J4) et le combiné (J10).
Suite conseillée : J10.

## 2026-11-12, Claude, lot J8 : saut à la perche

Fait : la règle des concours à barre passe dans `packages/game/src/events/bar-event.ts` (`defineBarEvent`), que la hauteur et la perche paramètrent ; les références de la hauteur restent identiques au chiffre près. `pole-vault.ts` : barre de 4,20 m, +15 cm ; planté à ±3, ±8, ±18 pas (5,80, 5,40, 4,95 m atteignables), renversement à ±4, ±9, ±15 pas (0, 8, 18 cm perdus) ; forme du jour ±5 cm ; plafond 5,85 m. Les temps d'un essai (270 pas) font tenir un concours, même avec deux échecs à chaque hauteur, dans les 90 s d'une partie. Sur `/jeu`, Malo rejoue le geste de `packages/mascot`, perche qui plie comprise ; la description des deux concours est commune (`bar-ui.ts`) ; le robot de test aussi (`bar.bots.ts`) (PR `feat/jeu-perche`).
Vérifié : `pole-vault.test.ts` (montée de la barre, coût du renversement, durée d'un concours, plafond), tests de la hauteur inchangés, références et 300 journaux sous Node, Chromium et WebKit, `e2e/game-page.spec.ts` ; flexion et réception regardées à 390 px.
Suite conseillée : J9.

## 2026-11-12, Claude, lot J7 : saut en hauteur

Fait : `packages/game/src/events/high-jump.ts`. Chaque essai : course automatique de 150 pas ; un appui à ±3 pas de l'instant juste donne 2,05 m atteignables, ±8 pas 1,96 m, ±18 pas 1,82 m (au-delà, refus) ; tenir pendant le vol, puis relâcher à ±3, ±8 ou ±14 pas du bon moment coûte 0, 3 ou 7 cm (relâcher trop tôt ou trop tard fait tomber la barre) ; forme du jour tirée de la graine, ±2 cm. Concours : barre de 1,60 m, +5 cm après chaque hauteur franchie, trois échecs de suite arrêtent tout ; marque, la plus haute barre franchie ; plafond 2,05 m. Sur `/jeu`, Noé rejoue le geste de `packages/mascot` cadré dans le canvas, la barre tombe sur le tapis en cas d'échec, un repère citron marque le point d'appel (PR `feat/jeu-hauteur`).
Vérifié : `high-jump.test.ts` (montée de la barre, trois échecs, refus, coût des écarts, barre tombée, plafond), références et 300 journaux sous Node, Chromium et WebKit, `e2e/game-page.spec.ts` ; élan, appel et vol regardés à 390 px.
À savoir : le repère d'appel a été ajouté après coup, faute de quoi l'instant de l'appel ne se devine pas. J5 vérifié en production le même jour (un saut joué sur tartan.coach/jeu).
Suite conseillée : J8.

## 2026-11-12, Claude, lot J6 : triple saut

Fait : `packages/game/src/events/triple-jump.ts`, sur l'élan et l'appel de la longueur. Le cloche-pied part à 24° au plus, la foulée à 12°, le saut à 18°. À chacune des deux réceptions, un appui à ±3 pas du contact garde 95 % de l'élan, à ±7 pas 92 %, à ±12 pas 88 % ; au-delà, ou sans appui, le rythme est cassé (score nul). Le sable commence à 9 m de la planche ; plafond théorique 15,596 m. Sur `/jeu`, Awa suit les trois temps du geste de `packages/mascot`, et un repère citron marque sur la piste où le pied va toucher (PR `feat/jeu-triple-saut`).
Vérifié : `triple-jump.test.ts` (rythme, coût de chaque pas d'écart, rythme cassé, mordu, essai nul, plafond), références et 300 journaux sous Node, Chromium et WebKit, `e2e/game-page.spec.ts` (une partie au clavier) ; cloche-pied et rythme cassé regardés à 390 px.
À savoir : deux réceptions parfaites à huit appuis par seconde donnent environ 12,5 m ; à douze appuis par seconde et vent favorable, environ 13,4 m. Le repère du contact a été ajouté après coup : sans lui, on ne peut pas anticiper la réception.
Suite conseillée : J7.

## 2026-11-12, Claude, lot J5 : saut en longueur

Fait : `packages/game/src/events/long-jump.ts`. Chaque appui bref ajoute 800 mm/s d'élan, le frottement en reprend 0,34 % par pas ; un appui tenu plus de 10 pas devient l'appel, l'angle monte d'un degré tous les deux pas (frottement quatre fois moindre pendant l'appel) ; relâcher lance le saut. Vol en entiers, sinus et cosinus figés en table ; marque mesurée depuis la planche ; mordu au-delà de la planche, essai nul avant le sable (un mètre après la planche) ; plafond théorique 9,378 m. Le jeu devient générique : `game-runner.tsx` fait tourner toute épreuve décrite par un `EventUi` (`hurdles-ui.ts`, `long-jump-ui.ts`) ; `/jeu` propose le choix de l'épreuve, chargée au premier geste. Les références de toutes les épreuves passent par `REFERENCES`, rejouées par les tests du paquet et la preuve inter-navigateurs (PR `feat/jeu-longueur`).
Vérifié : `long-jump.test.ts` (élan, appel, mordu, essai nul, marque depuis la planche, plafond), parties de référence et résumé de 300 journaux sous Node, Chromium et WebKit (`e2e/game-determinism.spec.ts`), `e2e/game-page.spec.ts` (une partie de longueur au clavier) ; élan, vol, mordu et réception regardés à 390 px.
À savoir : réglages choisis pour des cadences humaines : 8 appuis par seconde et la planche au plus près donnent environ 7,4 m, 6 par seconde environ 6,4 m, 5 par seconde environ 5,7 m. Un essai nul vaut 0 et n'est jamais un record. L'épreuve n'étant pas encore publiée, SIM_VERSION ne change pas.
Suite conseillée : J6.

## 2026-11-12, Claude, lot J2 : la page du jeu

Fait : `/jeu` (`app/(public)/jeu/page.tsx`) montre une affiche ; « Jouer au 110 m haies » charge alors le jeu (`hurdles-game.tsx`), qui fait avancer la simulation de `packages/game` par pas fixes de 1/120 s et dessine chaque image en canvas (`hurdles-scene.ts`). Inès court avec la foulée de `packages/mascot` (nouveau `hurdlerPose`, le pied le plus bas posé sur la piste) et saute à la hauteur que calcule la simulation. Record local, pause sur Échap et quand la page est cachée, résultats en HTML annoncés aux lecteurs d'écran. `/jeu` entre dans `SITE_PATHS`, le plan du site et les robots ; image de partage `public/brand/og-jeu.png`. La sérialisation SVG d'un athlète passe dans `src/lib/figure-svg.ts`, partagée avec la carte de record (PR `feat/jeu-page`).
Vérifié : `e2e/game-page.spec.ts` (affiche sans jeu chargé, pause, sauts au clavier, course jusqu'à l'arrivée, record gardé au rechargement, plan du site et robots), `packages/mascot/src/hurdler.test.ts` ; course et saut regardés à 390 px.
À savoir : un canvas ne lit pas les variables CSS : la police est lue sur la page et passée au dessin. Le contrôle du mouvement réduit (`motionOn`) ne compte plus une animation ramenée à 0,01 ms par le filet : sur une machine chargée, elle pouvait être saisie « en cours » et faire échouer le parcours du site (aléa vu à B9 et ici). Le journal des appuis n'est pas encore gardé : il le sera avec le classement (J3). Correctif de C3 en passant : la carte de record lisait ses polices par un chemin construit à la volée, ce qui faisait embarquer tout le projet dans la fonction ; les chemins sont maintenant écrits en entier et déclarés dans `outputFileTracingIncludes` (vérifié sur le fichier de traçage du build).
Suite conseillée : J5.

## 2026-11-12, Claude, lot C3 : carte de record

Fait : `GET /api/v1/orgs/[orgId]/athletes/[athleteId]/performances/[performanceId]/carte` rend une image PNG 1080 × 1350 (`next/og`, polices Barlow embarquées dans `apps/web/assets/fonts`) ; `performanceCard` (`performance.service.ts`) n'en donne que le prénom, la discipline, la marque et la date, et seulement pour un record battu. Sur la page Progrès, « Partager » remet l'image au menu de partage du téléphone, ou l'enregistre sur un ordinateur (PR `feat/carte-record`).
Vérifié : `tests/record-card.test.ts` (référence initiale sans carte, ni lieu ni vent, accès refusé à un coéquipier et à un autre espace, PNG au bon format), `tests/discipline-athlete.test.ts`, ligne de la matrice d'accès, `e2e/record-card.spec.ts` (menu de partage remplacé par un témoin qui reçoit le fichier) ; cartes et page Progrès regardées. Non vérifié : partage sur un vrai téléphone ; rendu sur Vercel (lecture des polices par `process.cwd()`, à confirmer après déploiement).
À savoir : Satori lit le SVG comme une image : l'athlète est sérialisé à la main (`figureSvg`), sans React. La première marque d'une discipline est la référence initiale, pas un record battu : elle n'a pas de carte.
Suite conseillée : J2.

## 2026-11-12, Claude, lot C2 : série de régularité

Fait : `regularity()` dans `packages/domain` compte les semaines de suite où l'athlète a rendu chacune de ses séances ; `regularityOf` et `athleteRegularity` (`stats.service.ts`) la lisent sur un an. L'accueil de l'athlète montre un tour de piste : la part courue est la semaine en cours, le chiffre au centre la série. La fiche de l'athlète côté coach porte « Série de régularité ». Les textes gelés de ces deux pages sont passés dans `packages/i18n` (PR `feat/regularite`).
Vérifié : `packages/domain/src/regularity.test.ts` (six cas), `tests/regularity.test.ts` (série lue en base, accès refusé à un autre espace), `e2e/regularity.spec.ts` (une séance rendue lance la série, le coach la lit) ; accueil et fiche regardés à 390 px. Non vérifié : aucun vrai téléphone.
À savoir : règle décidée par moi, à confirmer par le fondateur. Une séance partielle compte comme rendue, c'est un retour au coach. Une absence signalée excuse la séance, pour que dire « je ne viens pas » ne coûte jamais rien (lien avec C1). Une séance encore dans son délai de saisie (24 h après sa journée) ne casse rien. La série est en bas de l'accueil, après les séances : placée au-dessus, elle repoussait la séance du jour sous le pli, et le bandeau sortait de l'écran au clic, ce qui coupait sa transition (`e2e/session-open.spec.ts`). La clé `m.athletes.regularity` existait déjà pour une autre mesure (les quatre dernières semaines, page Progrès) : la série s'appelle `streak` dans les textes.
Suite conseillée : C3.

## 2026-11-12, Claude, lot C1 : absence signalée par l'athlète

Fait : l'athlète qui répond « je ne viens pas » prévient ses coachs (notification `absence_reported`, « Léa ne viendra pas jeudi »), une fois et pour une séance à venir ; il peut ensuite dire pourquoi, d'un geste de plus, parmi travail, études, transport, famille, autre raison. Le motif est enregistré dans `attendance.absence_reason` (migration additive), lu par le coach dans le suivi de la séance, effacé par « je viens » (PR `feat/absence-athlete`).
Vérifié : `tests/absence.test.ts` (liste fermée sans santé, une seule notification sans motif, motif effacé, séance passée muette), `packages/domain` (texte de la notification), `e2e/absence.spec.ts` (l'athlète sur téléphone, le coach lit la notification et le motif). Non vérifié : notification sur un vrai téléphone.
À savoir : la réponse existait déjà (elle bascule l'athlète en autonomie) ; le coach n'en était simplement pas prévenu. Le motif choisi n'est pas réaffiché à l'athlète quand il revient sur l'écran : seul le coach le relit. L'application mobile envoie `status` sans motif, ce que le contrat accepte toujours.
Suite conseillée : C2.

## 2026-11-12, Claude, lot B9 : finitions de l'application

Fait : la table commune de la console (`DataTable`, `console-ui.tsx`) devient une carte par ligne sur téléphone, première cellule en titre, les autres en paires libellé et valeur ; le tableau des espaces de `/admin` passe par elle ; son dernier texte en dur est déplacé. Connexion et création de l'espace : le groupe sur une ligne de piste (`start-scene.tsx`, option `scene` de `PublicPage`). Cinq e-mails portent un athlète dans leur bandeau, en PNG tirés par `pnpm --filter @tartan/web email:athletes` (PR `feat/da-finitions`).
Vérifié : `e2e/admin-console.spec.ts` (cartes sur téléphone, table dès la tablette), `e2e/age-confirmation.spec.ts` (la pose suit les trois temps), `tests/email-athletes.test.ts` (chaque image existe à la bonne taille, aucune dans un e-mail de sécurité) ; connexion, création de l'espace et deux e-mails regardés à 390, 768 et 1440 px. Non vérifié : aucun e-mail reçu dans une vraie messagerie avec son illustration ; aucun vrai téléphone.
À savoir : les composants web sont compilés en JSX « preserve » pour Next ; un script `tsx` qui les rend doit passer par `tsconfig.scripts.json`. Les images des e-mails ne sont servies par `tartan.coach` qu'après le déploiement. « Écrans immersifs passés aux jetons » était déjà fait : le lint refuse couleurs et durées en dur depuis A3 et B1, une recherche n'en trouve aucune.
Suite conseillée : C1.

## 2026-11-12, Claude, retouche du film et des sautoirs

Fait, à la demande du fondateur : dans le film de la page d'accueil, Inès court jusqu'au bout de sa course, au bord de la scène, et Malo va jusqu'à sa retombée sur le tapis et s'y relève avant le relais (`jump-film-pose.ts` : `HURDLES_END` à l'arrêt de la course, `POLE_VAULT_RANGE` jusqu'au relevé ; la perche passe de 0,28–0,48 à 0,27–0,52 du film, pris sur la hauteur, pour rester fluide). Les sautoirs de hauteur et de perche prennent les couleurs des tapis de stade, à la manière des sautoirs DIMA : corps bleu (`film.matBlue`), dessus rouge (`film.matRed`), liseré blanc au bord du dessus ; dans le film, les gestes de `packages/mascot`, la planche et le jeu (PR `fix/landing-tapis`).
Vérifié : `tests/jump-film-relay.test.ts` (Inès au bord de la scène, Malo sur le tapis, continuité des images), `tests/athlete-colors.test.ts` (liseré présent sur les deux sautoirs, dessus distinct du corps), 200 poses de référence du saut inchangées.
À savoir : aucun rouge n'atteint l'écart minimal avec la piste (0,087 au mieux pour 0,12) : un dessus rouge sur fond rouge ne se lirait pas, d'où le liseré blanc, que le test exige à la place de l'écart. Le test qui imposait de passer le relais avant le retournement du perchiste est remplacé : le corps vu par la tranche passe vite au défilement.

## 2026-11-12, Claude, lot B8 : écrans du coach

Fait : dans le constructeur de séance, « Publier » reste collé au-dessus de la barre de navigation sur téléphone, les autres actions au bout du formulaire (`session-builder.tsx`) ; dans tous les bandeaux, les actions tiennent sur une ligne qui défile de côté sur téléphone (`PageHeader`) ; le « +N » de la grille du mois passe de 10 à 12 px ; `tests/text-size.test.ts` refuse tout texte sous 12 px (PR `feat/da-coach`).
Vérifié : `e2e/coach-screens.spec.ts` sur téléphone et ordinateur : le bouton est à l'écran et rien ne le recouvre au début, au milieu et à la fin du formulaire, puis il publie ; les douze écrans du coach passés à 390 px par une sonde (aucun débordement, aucun texte sous 12 px) et regardés sur leur premier écran. Non vérifié : rien en production ; aucun vrai téléphone ; les écrans n'ont été regardés qu'en thème Tartan et sur un espace presque vide.
À savoir : une barre collante ne colle que dans son bloc parent : sur téléphone, le conteneur des actions est en `display: contents`, pour que le bouton colle dans la grille du formulaire entier ; sur ordinateur il redevient la barre d'actions unique. Ce lot n'est pas une refonte écran par écran : le plan nommait dix écrans, je n'y ai corrigé que ce que le regard et la sonde ont relevé. Le doublon « Phases de préparation » de la vue semaine du calendrier (le titre dépliable et son bouton) reste.
Aléa réparé en passant : sous WebKit, un parcours sur cent soixante-dix échouait à l'onboarding, le nom de l'espace resté vide. Cause : le titre du temps suivant recevait le focus une image après l'affichage (`requestAnimationFrame`), et arrachait la saisie à un champ déjà en cours de remplissage. Le temps s'affiche et prend maintenant le focus d'un seul geste (`flushSync` dans `onboarding-form.tsx`) ; `e2e/age-confirmation.spec.ts` le vérifie, et échoue sur l'ancien code. Un humain ne pouvait pas tomber dessus (une image, 16 ms), un robot si.
Suite conseillée : B9.

## 2026-11-12, Claude, lot B7 : écrans de l'athlète

Fait : `/aujourdhui` et `/seance/[id]` entrent dans le monde de travail (`src/lib/world.ts`) : bandeau piste, barre de navigation sur la piste, thème suivi ; l'écran de séance tient en un bandeau (retour, titre, date) et une feuille (état, type, validation, démarrage) ; la carte du jour s'ouvre en feuille de séance (`sessionCardName`, `seance/[id]/loading.tsx`) ; en thème clair, la carte héros passe au blanc des surfaces (PR `feat/da-athlete`).
Vérifié : `e2e/session-open.spec.ts` sur téléphone et ordinateur : bandeau sur l'accueil, groupe de transition au nom de la séance lu dans le navigateur, 200 ms, feuille et validation sur l'écran de séance, retour, carte distincte du fond en thème clair, axe ; quatre essais sur quatre sur le build de production ; accueil et écran de séance regardés à 390 px dans les trois thèmes, transition regardée au ralenti. Non vérifié : rien en production ; aucun vrai téléphone ; mode séance, progrès, calendrier et vidéos seulement regardés, pas modifiés.
À savoir : un élément partagé ne se retrouve que s'il existe dans la page d'arrivée au moment de la navigation, donc dans son écran d'attente : celui de la séance est un composant client qui lit l'identifiant par `useParams` et nomme sa feuille comme la carte. En développement, cet écran d'attente se compile à la première visite et le lien ne se fait pas : le parcours visite la séance une fois avant de mesurer ; en production il est préchargé avec le lien. Mettre l'accueil dans le monde de travail a révélé que la carte héros, craie, se confondait avec la page craie du thème clair. `BandSkeleton` est sorti de `SheetSkeleton` pour servir aux écrans d'attente propres à une route. `recordTransitions` et `firstTransition` sont dans `e2e/helpers.ts`.
Suite conseillée : B8.

## 2026-11-12, Claude, lot B6 : ossature de l'application

Fait : en-tête du téléphone sans le nom d'espace quand il n'y en a qu'un (il est dans le menu Réglages) ; libellés de la barre basse et pastille de notifications passés de 11 à 12 px ; `TrackTile` et `EmptyState` avec l'athlète de la rubrique (`src/lib/rubric-athlete.ts`) dans les seize états vides et sur la page d'erreur ; feuilles, dialogues, menu et messages animés à l'entrée et à la sortie (PR `feat/da-ossature`).
Vérifié : `tests/rubric-athlete.test.ts` (table de `DESIGN.md`, chaque état vide a sa rubrique, plus d'ancienne mascotte) ; `e2e/shell.spec.ts` sur téléphone et ordinateur (nom d'espace, animation du menu et de la feuille lue dans le navigateur, cibles de 44 px, aucun libellé sous 12 px, athlète de la rubrique, axe). Non vérifié : rien en production ; aucun vrai téléphone ; thèmes clair et sombre non regardés pour les états vides.
À savoir : `EmptyState` exige désormais `rubric` : le typage refuse un état vide sans athlète. La tuile est rouge piste dans tous les thèmes, exprès : une tenue réglée sur un fond ne tient pas sur une carte dont la couleur change avec le thème. Tailwind 4 pose ses `translate-*` sur la propriété `translate`, pas `transform` : une animation de `transform` s'ajoute donc au centrage du dialogue sans le casser. Une sortie animée garde l'élément 150 ms à l'écran : un parcours qui clique « Corriger » puis remplit aussitôt un champ trouve deux champs, et un contrôle axe lancé pendant qu'un menu s'efface voit un texte à demi transparent ; `expectAccessible` attend donc la fin des animations en cours, et le parcours de confirmation d'âge la fermeture du dialogue. Le parcours de l'ossature a trouvé un défaut plus ancien : le logo n'offrait qu'une cible de 28 px. Non fait, par choix : les rubriques Athlètes et Planificateur restent en icône seule dans l'en-tête du coach sur téléphone ; les mettre dans la barre basse ou sous un menu « Plus » change la navigation.
Suite conseillée : B7.

## 2026-11-12, Claude, lot B5 : page d'accueil et site

Fait : le film passe de 680 à 300 svh sur téléphone et 450 sur ordinateur, et devient un relais (`jump-film-pose.ts`, `jump-film.tsx`) : Inès aux haies, Malo à la perche, Noé à la hauteur, chacun dans son monde ; captures en une colonne sur téléphone, qui glissent à leur place au défilement ; bande du groupe (`group-band.tsx`) ; tarifs en cartes sur téléphone et tableau replié sous « Tout comparer » (`pricing.tsx`, donc aussi `/tarifs` et `/abonnement`) ; six questions du centre d'aide sur la page d'accueil (`help/questions.tsx`) ; athlètes du groupe sur la page introuvable et la page hors ligne (PR `feat/landing-stade`).
Vérifié : `tests/jump-film-relay.test.ts` (ordre du relais, pas de saut dans une scène, pieds au-dessus de la piste, perche plantée, habillage de chaque athlète dans chaque monde) ; les 200 poses de référence du saut en hauteur n'ont pas bougé ; `e2e/landing.spec.ts` sur téléphone et ordinateur (titre et bouton dans le premier écran, hauteur du film, relais, un seul geste joué à la fois, tarifs, questions, axe, mouvement réduit) ; page regardée rendue à 390 et 1440 px. Poids mesuré sur le build de production, téléphone : scripts 360 vers 373 ko compressés, document 22 vers 28 ko, affichage du plus grand élément inchangé à la mesure près. Non vérifié : rien en production ; aucun vrai téléphone ; Safari et Firefox.
À savoir : le film garde `poseAt`, le saut en hauteur sur sa durée propre, et y entre en pleine course par `highJumpTime` : ses effets (anneau, traînée, barre, confettis) se règlent sur cette durée, pas sur celle du film. La séquence de la perche s'arrête avant le retournement : vu par la tranche, le corps ne se lit plus, et un test le refuse. Les couleurs des athlètes du film sont des variables posées sur leur groupe SVG, changées au changement de monde, sans rendu React. Le film plus court rapproche les premières captures : sur téléphone, trois images (128 ko) se chargent désormais dès l'ouverture, en différé, sans bloquer l'affichage. `SURFACES` compte deux fonds de plus (bleu, citron) : chaque tenue a une couleur de repli, et la planche les montre. Un geste qui joue redessine sa scène à chaque image : la bande n'en joue qu'un à la fois, et aucun hors de l'écran.
Suite conseillée : B6. J4 posera l'aperçu du jeu après la ligne d'arrivée.

## 2026-11-12, Claude, lot B4 : transitions de page

Fait : enveloppe `src/components/ui/view-transition.tsx` (`PageTransition`, `Stay`) et `route-transition.tsx`, posées dans `AppShell` et dans la mise en page du site ; animations dans `globals.css`, sous « Transitions de page » ; l'écran d'attente `SheetSkeleton` porte désormais le même bandeau qu'un titre d'écran (PR `feat/view-transitions`).
Vérifié : `e2e/view-transitions.spec.ts` sur téléphone et ordinateur lit ce que le navigateur anime vraiment : fondu de 150 ms, bandeau et onglet actif en 200 ms, rien au-delà de 260 ms ni à la durée par défaut du navigateur, aucun fondu en changeant de semaine, plus rien qui dure en mouvement réduit, en-tête du site en place ; `tests/view-transition.test.tsx` ; images à mi-transition regardées à 4 % de la vitesse. Non vérifié : rien en production ; Safari et Firefox non regardés ; aucun essai sur un vrai téléphone.
À savoir : `<ViewTransition>` vient du React que Next embarque, pas du paquet `react` installé : l'enveloppe laisse passer ses enfants quand il manque, donc Vitest rend les pages sans rien changer ; les types viennent de `react/canary`. Une transition de vue ne part que si une frontière `<ViewTransition>` entre, sort ou se retrouve : le contenu est donc remonté par une clé égale au chemin, pas aux paramètres de recherche. Avec `loading.tsx`, la page d'arrivée affiche d'abord l'écran d'attente : un élément partagé ne se retrouve que s'il existe aussi dans cet écran, d'où le bandeau ajouté au squelette. C'est aussi pourquoi la carte de séance ne s'ouvre pas en écran de séance : la page de destination n'est pas là au moment de la navigation, et la précharger en entier montrerait à l'athlète une séance vieille de cinq minutes au plus ; reporté à B7, où la carte et l'écran changent de forme. React n'anime que ce qui est à l'écran : en bas d'une longue page, le bandeau ne participe pas. Le navigateur garde 250 ms par défaut sur tout ce qui n'est pas stylé : la racine est ramenée à 150 ms, et le parcours refuse toute durée de 250 ms. Deux éléments visibles du même nom font avorter la transition : un seul onglet actif visible à la fois, le parcours le vérifie. Effet de bord mesuré : React attend la fin d'une transition de vue avant d'appliquer la mise à jour suivante, donc le titre de l'onglet, que Next envoie à part, arrive parfois jusqu'à 185 ms après le contenu (jamais sur `main`, deux essais sur huit ici, à l'arrivée d'un athlète). `expectAccessible` attend donc un titre avant de juger la page ; l'annonce de changement de page aux lecteurs d'écran peut alors lire le titre de l'écran au lieu du titre de l'onglet.
Suite conseillée : la revue de la planche (F17), puis B5 ; B6 peut faire tracer les lignes du bandeau à l'arrivée.

## 2026-11-11, Claude, lot B3 : six gestes, six athlètes, motifs de piste

Fait : `packages/mascot` porte le corps des athlètes (`rig.ts` : mains, trois visages, quatre coiffures, dossard), les accessoires (`props.ts`) et un geste complet par épreuve (`hurdles`, `pole-vault`, `triple-jump`, `discus`, `long-jump`, `high-jump-event`, réunis dans `events.ts`) ; `packages/design-tokens/src/athletes.ts` porte les teints, les cheveux, les tenues et la règle qui habille chaque athlète selon le fond ; côté web, `Athlete`, `EventScene`, les motifs de `track.tsx` et la planche `/admin/mascotte` (PR `feat/gestes-epreuves`).
Vérifié : 87 tests dans le paquet (aucun saut d'une image à l'autre, pieds au-dessus du sol, appel sans mordre, appuis du triple saut sur le bon pied, perche qui plie sans s'allonger, bassin au-dessus de la barre, disque dans la main jusqu'au lâcher) ; `tests/athlete-colors.test.ts` sur les dix-huit couples athlète et fond ; `e2e/mascot-board.spec.ts` sur téléphone et ordinateur (axe, pas de défilement horizontal, lecture à la demande, mouvement réduit, refus d'un coach ordinaire) ; planche regardée rendue à 390, 768 et 1440 px. Non vérifié : rien en production ; aucun geste vu sur un vrai téléphone ; les gestes n'ont été jugés qu'à l'œil, sur des planches-contact, par l'agent.
À savoir : le squelette de base (`SKELETON`) n'a pas bougé, donc le film, la mascotte actuelle et le mobile dessinent le même personnage qu'avant ; un athlète du groupe passe par `rig()` puis `svgAthlete` ou `drawMascot({ bones })`. Entre deux clés, un pied posé glisse ou s'enfonce : `planted` et `sandFrame` déduisent le bassin du pied à chaque image, et les tests l'exigent. Les haies ne sont pas des clés dans le temps mais dans l'espace : la foulée avance avec le corps, donc les pieds ne patinent pas. Mesurer une couleur contre un fond par la luminance ne suffit pas : le premier teint hâlé avait la clarté de la piste ; la règle est un écart Oklab d'au moins 0,12. Dans un parcours, un compte administrateur ne s'inscrit qu'une fois : la planche a ses deux adresses dans `ADMIN_EMAILS` de `playwright.config.ts` et un seul test par écran. Choix à faire valider : prénoms, cheveux blonds de Malo, chiffres du dossard en traits droits.
Suite conseillée : la revue de la planche par le fondateur (F17), puis B4 ou B5 ; J2 peut dessiner les haies avec `CLIPS.hurdles` et `drawMascot`.

## 2026-11-11, Claude, CI : délai maximal et dépôts Ubuntu

Fait : `ci.yml` plafonne la tâche `quality` à 45 minutes et l'installation des navigateurs à 10 ; une étape « Dépôts Ubuntu, résolution de secours » précède cette installation (PR `fix/delai-ci`).
Vérifié : sur un serveur GitHub, pendant la panne, l'étape de secours suivie de `playwright install --with-deps chromium webkit` aboutit en 64 secondes ; sans elle, la même commande ne finit pas. Non vérifié : le plafond de 45 minutes n'a jamais eu à se déclencher.
À savoir : le 11 novembre 2026, à partir de 13 h 48 UTC environ, une panne DNS de Canonical a privé tous les serveurs GitHub des dépôts Ubuntu (ticket 15296 de `actions/runner-images`). apt réessaie alors chaque paquet pendant des heures sans échouer : la CI de la PR du lot B1 est restée figée 1 h 27, puis de nouveau après relance. Le résolveur d'Azure ne répondait plus pour ces trois noms, un résolveur public si : l'étape de secours écrit leur adresse dans `/etc/hosts`, et seulement quand la résolution normale échoue. apt vérifie la signature des paquets, donc l'adresse d'origine ne change rien à leur intégrité. Relancer une CI figée ne sert à rien tant que la cause dure : lire d'abord le journal de l'étape. Les autres workflows n'installent rien par apt.
Suite conseillée : aucune. Si l'étape de secours affiche un avertissement, c'est qu'aucun serveur ne résout plus les dépôts : attendre.

## 2026-11-11, Claude, lot B1 : jetons de mouvement

Fait : `packages/design-tokens/src/motion.ts` (huit durées, trois courbes, pas de cascade) et son miroir dans `globals.css` ; toutes les animations de la feuille de styles lisent ces jetons et sont déclarées sous `no-preference` ; filet de mouvement réduit en fin de feuille ; règle de lint `tartan/no-raw-motion` ; aide `expectNoMotion` ; miroir des couleurs étendu à toute la feuille ; CSS mort retiré (`demo-*`, `jump-range`, `film-frame`) (PR `feat/jetons-mouvement`).
Vérifié : `tests/design-tokens.test.ts` (28 cas) rapproche chaque couleur d'un jeton, refuse une durée ou une courbe en dur, une animation hors `no-preference`, une classe ou une animation sans usage ; `e2e/reduced-motion.spec.ts` sur téléphone et ordinateur ; sans le filet, trois de ses quatre parcours échouent ; types, lint, design, suite web et e2e. Non vérifié : rien en production ; aucun essai avec le réglage « réduire les animations » d'un vrai téléphone.
À savoir : Tailwind n'émet que les variables de thème utilisées : les jetons de mouvement sont dans un bloc `@theme static`, sinon `--ease-elan` manquait à l'exécution. Le navigateur réécrit `200ms` en `.2s` : comparer des millisecondes. Une animation ramenée à 0,01 ms reste « en cours » une image : `motionOn` attend deux images avant de juger. Les durées du film ont bougé de 40 ms au plus (460 vers 420, 220 et 240 vers 260) ; la célébration garde ses 1 150 ms, lus aussi par `victory.tsx`. Sans mouvement, `.victory` est en `display: none` : elle ne peut pas rester posée sur l'écran. Les classes composées dans le code (`world-${…}`, `victory-piece-${…}`) sont reconnues par le test du CSS mort à leur préfixe suivi d'une interpolation. Le détecteur de design refuse une courbe qui dépasse sa cible (`bounce-easing`) : « impulsion » est une courbe d'entrée et de sortie, sans rebond. Les jetons ne sont pas encore lus par l'application mobile.
Suite conseillée : B3 (six épreuves et composants de piste), qui modifie `globals.css` et les jetons à la suite de ce lot ; B4 pour les transitions de page, déjà couvertes par le filet.

## 2026-11-11, Claude, lot A7 : paiement de bout en bout en sandbox

Fait : T03. `tests-sandbox/payment-cycle.test.ts` joue le cycle de vente contre la sandbox Stripe : Checkout ouvert, carte de test, essai, premier prélèvement, facture, e-mails, remboursement partiel depuis la console, résiliation, retour en Découverte ; et la fin d'essai avec validation bancaire. `tests-sandbox/sdk-over-cli.ts` fait passer le réseau du SDK Stripe par la CLI et sert la vraie route du webhook à `stripe listen` (PR `test/stripe-sandbox`).
Vérifié : les quatre tests de la recette sandbox passent le 11 novembre 2026, trois fois de suite pour le nouveau fichier ; aucun événement signé refusé ni en erreur ; types et lint. Non vérifié : rien en production, aucun vrai paiement ; la page Checkout hébergée, le portail, la TVA et les litiges ne sont pas joués.
À savoir : cette recette est hors de `pnpm test` et de la CI ; commande dans `docs/plans/stripe.md`. Le Checkout réel ouvre un essai de 14 jours : pour obtenir une facture payée, le test termine l'essai par `trial_end: now`. Un abonnement créé « incomplet » par l'API n'est jamais rattaché à l'espace, donc son e-mail de validation bancaire est écarté comme obsolète : ce n'est pas un défaut, Checkout traite ce cas sur sa propre page ; le cas réel est la fin d'essai, qui est celui du test. Les e-mails de facturation partent dès la mise en file : ne pas vider la boîte de test avant de les compter. `tests-sandbox/stripe-cli.ts` porte l'identifiant du compte sandbox en clair, ce que les règles du dépôt public interdisent : il est dans l'historique depuis la V1.1, à décider par le fondateur (le passer en variable ne l'efface pas de l'historique). Aucun défaut de l'application trouvé dans ce lot.
Suite conseillée : la porte 10 est franchie. Côté agent il reste A13 (après F15) ; sinon la direction artistique (B1, B3) et le jeu (J2). Côté fondateur : F1 à F9, puis la recette réelle (A14).

## 2026-11-11, Claude, lot A6 : suppression de compte et connexion Apple et Google

Fait : T07 et T08. `e2e/account-deletion.spec.ts` supprime un compte par le client de l'app native, sur un vrai serveur ; `tests/auth-social.test.ts` (13 cas) couvre l'activation par variables, le parcours OAuth Google de bout en bout et la révocation Apple ; flux Maestro `apps/mobile/.maestro/destructive/account-delete.yml` et son identifiant `delete-confirm-word` sur le champ de confirmation (PR `test/compte-social`).
Vérifié : parcours de suppression sur téléphone et ordinateur (compte, sessions des deux appareils et espace effacés, ancien mot de passe refusé, l'athlète garde son compte) ; le test de liaison échoue quand on coupe la liaison dans `auth.ts` ; types, lint, suite web. Non vérifié : le flux Maestro n'a jamais été exécuté ; aucune connexion Apple ou Google réelle, les deux sont éteintes en production.
À savoir : aucun défaut trouvé dans ce lot. La configuration de Better Auth se lit au chargement du module : pour la tester sous d'autres variables, `vi.stubEnv`, `vi.resetModules`, puis import dynamique de `@/lib/auth`. Dans le parcours par code, Better Auth lit le jeton d'identité de Google sans en vérifier la signature, car il vient de l'échange serveur à serveur : le test remplace donc seulement cet échange. Un compte au mot de passe jamais vérifié n'est pas rejoint par Google (`requireLocalEmailVerified`, valeur par défaut de la bibliothèque) : c'est ce qui empêche de piéger l'adresse d'un autre ; un test le fige. La révocation Apple ne part que si un jeton de rafraîchissement est conservé, ce que la connexion native ne fait pas (M6).
Suite conseillée : A7 (T03), qui demande la session Stripe CLI du fondateur (F16). Sinon A13 après F15, ou la direction artistique (B1).

## 2026-11-11, Claude, lot A5 : actions d'administration et export comptable

Fait : T05 et T06. `tests/admin-console-actions.test.ts` (24 cas) appelle les actions serveur de la console ; `tests/admin-accounting-export.test.ts` (6 cas) appelle le handler de l'export. Deux défauts corrigés : la route d'export laissait remonter le refus, donc répondait 500 au lieu de 401 ou 403 ; la page des revenus préchargeait l'export à chaque visite par un lien Next, remplacé par un lien de téléchargement (PR `test/admin-actions`).
Vérifié : les six tests d'export échouent sur l'ancienne route et passent sur la nouvelle ; la route est entrée dans la matrice d'accès, qui n'a plus aucune route reportée ; parcours `e2e/admin-console.spec.ts` étendu au téléchargement, sans préchargement ; types, lint, suite web (1 687 tests). Non vérifié : rien en production ; aucun remboursement ni aucune résiliation réels.
À savoir : pour tester une action serveur hors de Next, il suffit de remplacer `next/headers` (en-têtes portant le cookie d'une vraie session) et `next/cache` ; session, vérification de passkey et service restent réels. Le SDK Stripe n'ajoute pas de clé d'idempotence quand `maxNetworkRetries` vaut 0. Dans la matrice d'accès, une ligne placée après les routes qui ferment les sessions reçoit 401 pour tout le monde : mettre les nouvelles lignes en tête. Constat laissé en l'état : accorder une offre, supprimer un compte, résilier et prolonger un essai n'exigent qu'une passkey vérifiée dans les 12 heures ; seul le remboursement exige dix minutes. L'export classe les factures par date d'encaissement en UTC : une facture encaissée le 31 décembre après 23 h, heure de Paris, tombe dans l'année suivante. Les textes de la page des revenus sont passés dans `m.admin.revenue` ; il reste 267 textes gelés dans 46 fichiers.
Suite conseillée : A6 (T07, T08), puis A7 quand la session Stripe CLI est ouverte.

## 2026-11-11, Claude, lot A12 : centre d'aide

Fait : page publique `/aide` (37 questions en huit thèmes numérotés comme des couloirs), sa version sans offre pour l'app native (`/mobile/aide`), « Aide » dans le menu Réglages de chaque écran avec deux repères propres à l'écran, lien « Aide » dans le pied du site, les réglages et les réglages du mobile (PR `feat/aide`).
Vérifié : `tests/help.test.ts` (huit cas), parcours `e2e/help.spec.ts` sur téléphone et ordinateur avec axe, clavier et mouvement réduit, `/aide` regardée rendue à 390, 768 et 1440 px, `/mobile/aide` sans prix ni lien de vente, types, lint, design, suite web. Non vérifié : rien en production ; la ligne « Aide » du mobile n'a pas été vue sur appareil ; l'ouverture des liens dans un autre onglet n'a pas été essayée dans la PWA installée.
À savoir : aucune route d'API, aucune donnée, aucune migration : le centre d'aide est une page statique. Les textes sont dans `m.help`, la structure dans `apps/web/src/features/help/content.ts` ; un test échoue si une question écrite n'est pas classée. Chaque réponse a été vérifiée dans le code avant d'être écrite. `docs/exploitation/support.md` disait à tort qu'un propriétaire devait transmettre son espace avant de supprimer son compte : l'espace revient au plus ancien autre coach, ou disparaît. Les annonces n'ont pas de commentaires. `LaneNumber` (`src/components/lane-number.tsx`) est le premier motif « numéro de couloir » partagé : le lot B3 le reprend. Instabilité vue une fois sur 150 parcours : sous WebKit, `createCoachSpace` n'a pas trouvé la case des conditions après « Continuer » (`e2e/terrain.spec.ts`, mineur refusé) ; rejoué seul, le fichier passe. `expo-doctor` est désormais fixé en 1.21.6 dans `mobile-native.yml` : la 1.21.7, sortie le jour même, ne démarre pas ; à relever quand une version saine paraît.
Suite conseillée : A5 à A7, puis A13 quand F15 est décidé. Les questions fréquentes de la page d'accueil (lot B5) se tirent de `helpThemes()`.

## 2026-11-11, Claude, lot A11 : arrivée de l'athlète

Fait : e-mail de bienvenue à la première arrivée dans un espace ; rappel unique d'une invitation nominative sans réponse, avec opposition par adresse ; encart d'accueil sur `/aujourdhui` pendant la première semaine, qui déclenche tout de suite le bandeau d'installation et de notifications (PR `feat/accueil-athlete`).
Vérifié : `tests/athlete-arrival.test.ts` (sept cas), registre et documentation contrôlés par test, parcours `e2e/athlete-welcome.spec.ts` sur téléphone et ordinateur avec axe, encart regardé rendu à 390, 768 et 1440 px, types, lint, design, suite web. Non vérifié : aucun envoi réel ; le bandeau d'installation n'a pas été vu sur un vrai téléphone.
À savoir : pas de migration, l'accueil se déduit de la date d'arrivée et de l'absence de séance validée, et se referme sur l'appareil. Il n'y a pas d'écrans d'installation en plus : le bandeau existant (`install-banner.tsx`) faisait déjà ce travail après une première action. Le rappel compte ses trois jours depuis la dernière action sur l'invitation, donc un renvoi par le coach le repousse. L'opposition d'une personne invitée met son adresse en liste de blocage : un coach qui la réinvite n'en est pas averti. Le webhook Stripe de production écoute les 15 événements (constaté par l'API le 11 novembre).
Suite conseillée : A12, puis A5 à A7.

## 2026-11-11, Claude, schéma Prisma réaligné sur les migrations

Fait : `schema.prisma` décrit de nouveau la base que produisent les migrations. Trois identifiants (`athlete_consents`, `email_outbox`, `external_deletions`) sont générés par la base, comme leurs migrations l'avaient posé ; la clé étrangère de `checkout_intents` porte la même règle de mise à jour qu'en base. Aucune migration : seul le schéma change (PR `fix/ecart-schema-migrations`).
Vérifié : `prisma migrate diff` vide sur une base neuve migrée ; `prisma migrate dev` rend la main sans demander de nom ; `tests/schema-migrations.test.ts` échoue sans le correctif et passe avec ; types, lint, toute la suite web. Non vérifié : rien en production, où la base ne change pas.
À savoir : le nouveau test compare le schéma à la base de test reconstruite par les migrations. S'il échoue, le script qu'il affiche est soit la migration qui manque, soit le signe d'une erreur dans le schéma. Après avoir tiré `main`, relancer `corepack pnpm install` : un paquet ajouté par une autre branche fait sinon échouer les tests au chargement.
Suite conseillée : A11.

## 2026-11-11, Claude, fusions et lots des sessions parallèles

Fait : PR 53 à 63 fusionnées par l'agent, avec l'accord du fondateur, CI verte pour chacune. Quatre lots faits par des sessions parallèles, dont les entrées n'avaient pas pu être écrites ici : A1 (personas et matrice d'accès, PR 57), A2 (tests des webhooks Stripe et RevenueCat, PR 54), B2 (squelette unique de la mascotte, PR 62), J1 (simulation déterministe et 110 m haies, PR 56).
Vérifié : après chaque série de fusions, `/api/v1/version` sert le dernier commit de `main`, `/api/health` répond 200, Vercel ne remonte aucune erreur nouvelle ; film de la page d'accueil vu en production à 375 px avec le nouveau squelette, curseur de la frise mobile. Non vérifié : mascotte mobile sur appareil ; migration `profiles.email_tips` constatée seulement par la santé de l'application.
À savoir : deux PR vertes séparément peuvent se contredire une fois fusionnées. C'est arrivé entre A1 et A2 (matrice d'accès attendant 400, route répondant 503), `main` est resté rouge jusqu'à la PR 61. Avant de fusionner des branches parallèles, fusionner `main` dans la suivante et relancer les tests. `next-zod-route` valide avant d'authentifier : un test d'accès exige une requête valide. Pour tester Stripe sans mock de service, remplacer seulement le transport du SDK. Plusieurs sessions partagent `tartan_test`, `tartan_e2e` et le port 3100 : donner à chacune sa base par `TEST_DATABASE_URL` et `E2E_DATABASE_URL`. Dans le film, les os sont à plat sous le groupe du corps, repérés par `data-bone` ; une classe qui anime un os se pose sur un groupe intérieur.
Suite conseillée : A11, A12, puis A5 à A7. Côté jeu, une deuxième épreuve (J5) ; côté mascotte, les cinq autres gestes (B3).

## 2026-11-11, Claude, lot A10 : e-mails d'activation

Fait : séquence d'activation du coach à J+1, J+3 et J+7 sur la prochaine étape manquante ; e-mail de plafond presque atteint ; préférence « conseils » avec désinscription en un clic et réglage ; migration additive `profiles.email_tips` (PR `feat/emails-cycle-de-vie`).
Vérifié : tests du domaine, `tests/lifecycle-emails.test.ts` (sept cas), registre et documentation contrôlés par test, types, lint, design. Non vérifié : aucun envoi réel ; la tâche de 9 h n'a jamais tourné en production avec ces deux travaux ; réglage « conseils » non regardé rendu.
À savoir : la reconquête n'est pas construite, c'est de la prospection et elle attend F4. Pas d'e-mail « essai sans activation » : la séquence le couvre. La migration est écrite à la main, `prisma migrate dev` restant bloqué par l'écart de schéma noté dans ETAT. Le test du registre échoue tant qu'un nouvel e-mail n'est pas décrit dans `docs/reference/emails.md` : c'est voulu.
Suite conseillée : A11, puis A12.

## 2026-11-11, Claude, lot A9 : premiers pas du coach

Fait : règle pure des premiers pas (`packages/domain/src/onboarding.ts`), guide « Pour démarrer » du suivi passé à quatre étapes avec compteur ; création de l'espace en trois temps ; textes de l'onboarding sortis du code (PR `feat/premiers-pas-coach`). `docs/reference/onboarding.md` corrigé : il disait à tort que rien ne guidait le coach, alors que le guide existait déjà.
Vérifié : tests du domaine, types, lint, design ; parcours Playwright `age-confirmation`, `training-profile` et `billing-alert` en local, sur téléphone et ordinateur ; onboarding regardé rendu à 390 et 1440 px. Non vérifié : rendu à 768 px ; aucun coach réel n'a joué le parcours ; suite Playwright complète laissée à la CI.
À savoir : pas de migration, le guide se déduit toujours de l'état réel. Les boutons « Continuer » et « Créer mon espace » portent chacun une clé : sans elle, React transforme le bouton cliqué en bouton d'envoi pendant le clic et soumet le formulaire. Les parcours e2e passent par `nextOnboardingStep`. `pnpm db:migrate` demande un nom de migration à cause d'un écart ancien entre le schéma et les migrations (voir ETAT) : utiliser `prisma migrate deploy` en local. Le lanceur d'Impeccable est refusé à l'exécution sur ce poste : lire sa référence `craft-floor.md` à la main.
Suite conseillée : A10, qui lit `coachNextStep`.

## 2026-11-11, Claude, lot A8 : registre des e-mails

Fait : registre unique des 25 e-mails avec catégorie (`email-registry.ts`), exigé par `sendEmail` ; un rebond bloque tout, une plainte ou une désinscription épargne les e-mails de sécurité ; adresse qui rebondit annoncée au formulaire de connexion ; invitations passées par la file ; genre inconnu marqué en échec ; objets d'e-mail dans `packages/i18n` (PR `feat/email-registry`).
Vérifié : `tests/email-registry.test.ts` (douze cas), toute la suite web (847 tests), types, lint, design. Non vérifié : aucun envoi réel ; le lien de connexion, seul e-mail éprouvé en production, garde son envoi direct mais passe désormais par le contrôle de blocage avant le rendu ; Resend tient sa propre liste de suppression et peut refuser un envoi que Tartan laisse passer.
À savoir : le contrôle de blocage tourne aussi en local et en test, avant le rendu. La réinitialisation de mot de passe avale volontairement une adresse qui rebondit, pour ne pas révéler l'existence d'un compte. La file ne garde jamais le lien d'une invitation. `flushEmailOutbox` accepte une clé pour ne traiter qu'une ligne.
Suite conseillée : A9, puis A10.

## 2026-11-11, Claude, lot A4 : finitions du paiement

Fait : événement `invoice.payment_action_required` et son e-mail ; bandeau de paiement à régulariser dans tout l'espace coach, pour le propriétaire ; un message de plafond atteint mène aux offres ; liste des factures sur `/abonnement` ; rattrapage horaire élargi à 200 espaces dans un budget de 40 s ; CGV qui lisent les plafonds dans `plans.ts` (PR `feat/paiement-finitions`).
Vérifié : `tests/payment-action-required.test.ts` (dix cas), suites de facturation et d'e-mails, types, lint, design ; CGV regardées rendues en local à 390 px. Non vérifié : aucun événement réel de Stripe, la validation 3-D Secure n'a jamais été jouée ; le parcours `e2e/billing-alert.spec.ts` (bandeau, factures, axe à 390 px) est écrit mais n'a pas tourné en local, le port 3100 étant pris par une autre session : la CI le joue.
À savoir : le webhook de production ne reçoit pas le nouvel événement tant que `stripe-setup` n'est pas relancé (F14) ; la console l'affiche. Un incident de paiement n'envoie qu'un e-mail : celui de validation remplace « paiement échoué » s'il est en file dans la même heure, et s'efface si « paiement échoué » est déjà parti. Le lien vers les offres est reconnu par le texte du message de plafond, pour ne pas toucher vingt appels.
Suite conseillée : A8, puis A9.

## 2026-11-11, Claude, lot A3 : garde-fous de direction artistique

Fait : trois règles ESLint locales (`apps/web/eslint-rules`) : couleur brute, palette Tailwind par défaut, texte en dur dans le JSX et les attributs de libellé. 20 couleurs brutes corrigées (écrans vidéo, mode séance, ombres, page de paiement Stripe) ; rôles `on-ink`, `shadow-float` et `shadow-float-strong` ajoutés au thème (PR `feat/garde-fous-da`).
Vérifié : tests des règles, miroir des jetons, types, lint, design ; couleurs et ombres calculées identiques à l'ancien rendu, relevées dans le navigateur. Non vérifié : la suite Playwright complète n'a pas tourné en local, cinq sessions partageant le port 3100 et la base `tartan_e2e` ; elle tourne en CI.
À savoir : 274 textes hérités sont gelés dans `eslint-suppressions.json`, que le lint tolère sans jamais l'agrandir ; un test plafonne ce volume. Le lint passe `--pass-on-unpruned-suppressions` pour que des PR parallèles ne se bloquent pas ; `lint:prune` retire les entrées devenues inutiles. Dans une scène encre, le blanc s'écrit `text-fg` ; hors scène, sur un aplat encre, `text-on-ink`.
Suite conseillée : A4, puis A8.

## 2026-11-11, Claude, plan de fin de projet et documentation

Fait : audit du code, des écrans et de la documentation ; plan en lots approuvé par le fondateur (vente A1 à A13, direction artistique B1 à B9, ajouts C1 à C3, jeu J1 à J10) ; documentation remise à plat (PR `docs/remise-a-plat`). `PRODUCT.md` et `DESIGN.md` portent les décisions du 11 novembre. Nouveaux documents : direction artistique, incident, support, e-mails, onboarding.
Vérifié : liens entre documents contrôlés par script ; types, lint, tests et design après la correction de la signature des e-mails (« Yodev, entreprise individuelle »). Non vérifié : rien n'a été éprouvé en réel, aucun lot de code n'est commencé ; les chemins cités comme « à créer » n'existent pas encore.
En cours ou abandonné : rien.
À savoir : les anciennes tâches d'agent A1 à A12 sont renumérotées. A1 est devenu les lots A1, A2, A5, A6, A7 ; A2 et A4 le lot A13 ; les tâches mobiles M1 à M6 ; l'IA P1 et P2. La file d'e-mails expire tout message de plus de 24 h : une séquence se met en file le jour dû. Les liens de connexion ne passent pas par la file. La simulation du jeu doit rester en arithmétique entière. Les anciens audits non suivis ont quitté le dépôt.
Suite conseillée : A1 et A2 en parallèle, puis A3.

## 2026-11-09, Claude, remise en état et passation

Fait : webhook Mux réparé et rattrapage horaire (PR 48). Console Configuration, tarifs sur la landing, accord OpenAI, CGV, correctifs de l'audit des frontières (PR 49). Enrôlement de la passkey réparé (PR 50). Préparation des stores (PR 51). Documentation refondue.
Vérifié : lint, types, tests, design, Playwright sur build de production ; passkey créée en production ; vidéo réelle passée à prête.
Non vérifié : e-mails reçus, paiement réel, push, téléphones physiques.
À savoir : les variables Vercel de type Secret ne se relisent pas, même avec `vercel env run`. Une variable modifiée n'agit qu'après un nouveau déploiement. La bibliothèque de passkeys n'envoie pas `fetchOptions` à sa première requête.
Suite conseillée : A1, à commencer par T01.

## 2026-11-14, Codex, F9 : rejeu natif après validation du catalogue
Sous Node 22/pnpm 10, les 1 952 tests serveur passent avec la précondition de catalogue non approuvé isolée dans le test concerné. Sur simulateur iPhone 16e, le constructeur simple passe (1 min 24), les circuits coach et athlète passent ensemble (4 min 16) et le parcours modes IA/exercice inconnu/création privée/brouillons passe (3 min 37). Les dialogues iOS sont traités explicitement ; aucune assertion métier retirée. Ces preuves locales utilisent le prestataire IA simulé et ne qualifient ni OpenAI réel ni un téléphone physique.
## 2026-11-14, Codex, F5 : rétablir la précondition de relecture
La CI navigateur a révélé deux assertions modifiées trop largement lors de l’approbation du catalogue : avant relecture, le bouton doit rester désactivé, après dictée comme après saisie. Les deux attentes sont rétablies ; le scénario proposition avec catalogue approuvé et relecture cochée garde son attente activée. Aucun comportement applicatif assoupli. Traces CI relues ; les huit parcours IA ciblés passent sous Node 22/pnpm 10 et build de production, en 2 min. Prestataire simulé, aucune nouvelle qualification OpenAI déduite.
## 2026-11-14, Codex, F1 : rétablissement de la sauvegarde après changement de connexion
Reprise de la branche de recette/exploitation : secret GitHub de sauvegarde mis à jour avec le rôle dédié, droits de lecture seule contrôlés. Le rejeu distingue une authentification périmée puis un magasin de certificats absent dans le conteneur PostgreSQL. Le workflow monte désormais le bundle Ubuntu en lecture seule et conserve verify-full. Validation par export chiffré et dépôt Blob privé en cours ; aucune réussite déduite du seul changement de secret.

Preuve complétée : export privé du 14 novembre à 02 h 10 UTC réussi et relu à l’identique (334 190 octets), puis restauration locale isolée en 0,31 s, 83 tables/50 migrations sans erreur ni contrainte non validée. Base et secrets temporaires retirés. Les erreurs brutes de pg_dump sont désormais capturées puis supprimées : elles contiennent le nom de connexion et ne doivent pas paraître dans les journaux publics. Rejeu du workflow et fusion encore requis.

## 2026-11-14, Codex, intégration du catalogue
PR 123 fusionnée après contrôles verts : qualité 50 min 19, Maestro 43 min 34 et Android 17 min 47. Régression locale : 222 parcours réussis, 22 ignorés selon options, aucun échec. PR 125 remise à jour depuis main ; résolution documentaire en conservant la distinction des lots et des interventions du fondateur. Publication et nettoyage Git suivis après vérification du déploiement.

## 2026-11-14, Codex, exploitation : preuve de contenu et catalogue publié
Production `a3d603f` vérifiée, santé OK, guide Arraché version 2 approuvé ouvert dans le compte existant et 150 fiches communes distinctes/approuvées confirmées en base. Branche catalogue supprimée localement et à distance après contrôle d’ascendance. PR 125 fusionnée après CI verte (47 min 7) ; sauvegarde main et déploiement suivis séparément.
Comparaison de contenu des 83 tables, par empreintes SHA-256 calculées dans PostgreSQL sans extraire les données personnelles : 76 tables identiques intégralement. Sur les sept autres, comparaison par clé et colonnes communes : aucune ligne de la branche conservée ne manque ou n’est modifiée ; seules des lignes supplémentaires et les colonnes ajoutées par migration diffèrent. Preuve privée conservée hors dépôt. Cela remplace la simple comparaison agrégée comme preuve entre ces deux états, sans transformer la restauration finalisée en recette isolée.
