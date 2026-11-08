# Suppression des séances et des modèles sur mobile

Lot du 8 novembre 2026, fondé sur `d27e460`, dans la PR #45 en brouillon. Aucune migration SQL ni activation en production.

## Comportement

Le constructeur natif permet de supprimer une séance enregistrée après confirmation explicite. La confirmation annonce la perte des réalisations et des modifications locales. La requête porte la version lue et le nombre de validations annoncé. Une modification ou une nouvelle validation entre la lecture et la suppression déclenche un conflit ; l'envoi n'est jamais rejoué automatiquement. La même protection est utilisée par le constructeur web. Les anciennes applications peuvent encore appeler DELETE sans paramètres ; elles bénéficient du contrôle des droits et du verrou pendant l'opération, mais pas d'une comparaison avec leur ancien écran.

La suppression et la mise en file des annulations sont transactionnelles. Une panne de file conserve la séance ; une panne du prestataire après validation laisse la notification durable au cron. Les doublons concurrents n'émettent qu'une annulation. Un audit sans contenu sportif est conservé.

Les modèles peuvent être retirés depuis la feuille native. Le serveur indique les modèles supprimables et recontrôle les droits à chaque requête : propriétaire ou auteur, avec accès à l'espace. Supprimer un modèle n'affecte pas les séances créées à partir de celui-ci. Un modèle nouvellement enregistré devient disponible immédiatement dans le même constructeur.

## Preuves automatiques

- 509 tests serveur réussis sur la suite complète ; huit tests ciblés de suppression après ajout du cas de compatibilité ancien client.
- 198 tests mobiles réussis ; types monorepo réussis.
- Deux parcours API authentifiés sur build de production réussis, projets desktop/mobile : création, modèle, suppression du modèle sans perte de séance, adaptations, versions, publication, refus athlète, confirmation incomplète refusée et suppression avec disparition dans les vues coach/athlète.
- Lint web sans erreur, quatre avertissements préexistants. Les nouveaux tests ne contactent aucun prestataire de notification.

## Recette iOS partielle

iPhone 17 Pro simulé, iOS 26.3, client de développement `coach.tartan.app.dev`, API locale de production port 3102 et base synthétique `tartan_v11_e2e`.

Connexion, calendrier, titre, choix du groupe, ajout d'un développé couché et ouverture de sa prescription ont été observés. Après arrêt du simulateur, relance et reprise confirmée, le titre, le groupe, l'exercice et la prescription non appliquée ont été retrouvés. L'application Simulator et les appareils simulés ont ensuite été arrêtés de nouveau dans l'environnement partagé. La publication et la suppression depuis les écrans n'ont donc pas encore été validées.

Une première ouverture du client de développement, avant cette recette, a aussi produit un crash natif `EXC_BAD_ACCESS` dans `facebook::jsi::Pointer::~Pointer()` ; la relance a réussi. Sa cause n'est pas établie. Ce constat doit être vérifié sur un build natif propre ; les bundles Hermes et les tests TypeScript ne prouvent pas la stabilité de ce binaire.

La recette sur téléphones physiques, VoiceOver/TalkBack, l'ensemble des interruptions réseau et les builds signés restent ouverts. La CI du lot de reprise `d27e460` a franchi Expo Doctor et atteint la compilation Android ; son résultat terminal et la CI du présent lot doivent être suivis séparément.

## Reprise et publication iOS — 8 novembre, 00 h 27 CET

Commit testé `9cf9c83b03e4907668986d465d7ceea36919afc5`. La compilation locale `expo run:ios --no-bundler --no-install` a réussi, avec trois avertissements et aucune erreur ; elle réutilise le projet et les caches natifs existants. Ce résultat ne constitue donc pas une reconstruction sans cache. Le binaire a été installé sur le même iPhone 17 Pro simulé. API locale 3102, Metro 8083 et base synthétique `tartan_v11_e2e` ; aucun service de production utilisé.

Parcours effectué dans l'interface native après relance demandée par le fondateur :

1. Calendrier → nouvelle séance : proposition de reprise du brouillon `Recette publication iOS`.
2. Relecture et confirmation : titre, groupe et prescription non appliquée restaurés.
3. Modification de la prescription à **3 séries × 4 répétitions × 40 kg**, récupération 150 secondes, puis application.
4. Enregistrement : message « Brouillon enregistré. » et actions de séance enregistrée visibles.
5. Publication : résumé montrant les trois séries, quatre répétitions, 40 kg et le groupe ; confirmation distincte, puis message « Séance publiée ».
6. Contrôle SQL en lecture seule : une seule séance correspondante, version 3, `published_at` renseigné et snapshot conservant exactement `{sets: 3, reps: 4, load: {type: "kg", value: 40}, rest_s: 150}`.

Aucun nouveau crash observé pendant ce parcours. Cela ne résout pas la cause du crash antérieur et ne valide ni les téléphones physiques ni la réception des notifications. La suppression depuis l'interface native reste à éprouver ; sa couverture serveur et HTTP est décrite plus haut. Le titre de l'écran restait « Nouvelle séance » après le premier enregistrement ; le lot vidéo corrige ce libellé à partir de l’identité enregistrée de la séance.

CI de `9cf9c83` à ce point : lint, types, tests et design réussis ; parcours navigateur encore en cours (run `42424816384`) et compilation Android encore en cours (`42424816377`). Preview Vercel et GitGuardian réussis. Aucun résultat terminal de ces deux workflows n'est déduit des étapes déjà vertes.
