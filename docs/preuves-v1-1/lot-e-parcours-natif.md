# Lot E — parcours natif et aperçu individuel, 8 novembre 2026

État : parcours natif raccordé, compilable et isolé par les drapeaux ; non activé en production. La recette visuelle et sur téléphones n’est pas acquise. Le parcours web et le corpus d’évaluation restent à terminer. La liste de reprise privée a été ajoutée dans le lot suivant, décrit ci-dessous.

Services, contrats et tests associés : commit `600c6dc`. Les écrans et cette preuve sont enregistrés dans le commit natif suivant, dans la même PR #45.

## Parcours natif raccordé

- Entrée dans le calendrier uniquement si le serveur annonce l’IA disponible pour le rôle, l’offre et les deux drapeaux. Le chargement recontrôle ces conditions avant d’ouvrir le formulaire ou le micro. L’ancien contrat `/me` reste compatible, le booléen ajouté est facultatif pour les anciens serveurs/clients.
- Choix d’un à sept jours, groupes/athlètes autorisés, bibliothèque entière ou sélection bornée ; contexte de phase relu par date. Les jours sans ambiguïté sont synthétisés ; les jours à vérifier s’ouvrent séparément. Une nouvelle proposition conserve la sélection dans le même espace.
- Consigne écrite ou dictée native, information sur le traitement audio, relecture explicite. Une transcription est ajoutée sans supprimer silencieusement le texte saisi. Au-delà de 12 000 caractères, le coach doit raccourcir sa consigne ; aucune troncature envoyée au modèle.
- Questions du modèle affichées avec réponses suggérées facultatives et réponse libre ; nouvelle relecture, cinq échanges au maximum. Hypothèses, suggestions et consignes interprétées restent distinctes.
- Revue des séances : dates, heure, durée, catégorie, destinataires, prescriptions et exercices. Un remplacement nécessite confirmation, reprend le défaut de la nouvelle fiche et retire les adaptations de cet item. Les pourcentages restent liés à l’exercice correspondant.
- Aperçu individuel obligatoire côté interface avant confirmation de chaque séance. Le coach voit les valeurs calculées, la référence et sa date, les maxima manquants ; il peut adapter une charge en kg ou en pourcentage, ou revenir à la charge commune. Les références ne sont pas transmises au modèle. Les cibles RPE/RIR restent distinctes.
- Validation explicite de brouillons uniquement. Aucune notification, publication ou publication programmée n’est disponible dans cette commande. Les brouillons sont ensuite ouvrables dans le constructeur complet ou publiables séparément depuis le calendrier.
- Déduplication des appuis, demande de génération/clarification conservée à l’identique après réponse perdue, récupération par lecture, confirmation rejouée avec le même contenu. Une relecture après échec de confirmation conserve les ajustements. Délai de deux minutes et annulation locale au démontage ; les réponses tardives ne changent pas la route d’un autre écran/compte. Le serveur peut terminer une demande déjà reçue, selon son cycle durable.

Les formulaires et aperçus restent en mémoire : aucun ajout à la liste de requêtes persistées, aucune file hors ligne contenant la dictée. Les brouillons serveur survivent au redémarrage. La proposition privée est relisible par sa route tant qu’elle existe ; une liste privée permet maintenant de la retrouver après fermeture complète (recette interactive encore ouverte). Les modifications locales non envoyées sont annoncées comme perdues en quittant.

## Contrats et serveur

`phaseChoicesByDate` est additif au JSON de sélection. Les anciens choix communs restent le comportement de repli ; un tableau vide pour un jour est un choix explicite. Dates hors période, dates dupliquées et doubles choix d’athlète sont rejetés. La canonicalisation conserve l’idempotence malgré l’ordre des jours/choix. Les brouillons utilisent le choix de leur propre date.

Nouvelle route authentifiée `POST /api/v1/orgs/:orgId/planner/proposals/:proposalId/preview`, partagée via le SDK. Elle exige l’auteur, l’espace, les droits, les drapeaux, la version et une proposition non expirée. L’aperçu ne consomme pas de quota, ne fait aucun appel IA et n’écrit aucune séance. Il utilise le résolveur de prescriptions existant et respecte la date d’entrée dans le groupe. Les adaptations hors destinataires, références d’un autre exercice, identifiants d’items absents/dupliqués et exercices hors sélection sont refusés, également à la confirmation.

Les références et charges affichées sont **provisoires jusqu’à la publication** : les brouillons gardent les prescriptions et adaptations, puis la publication conserve la référence effectivement utilisée. Une charge absolue explicite n’est pas remplacée par un pourcentage ni par une cible RPE.

Pagination à dix athlètes maximum, réduite pour les séances très longues afin de ne pas renvoyer plus de 1 500 items sur une page. Le curseur appartient à l’audience autorisée et l’offset est explicite. Le maximum contractuel de 720 items est testé : deux athlètes, 1 440 items, réponse sous 3 Mio avec notes synthétiques longues. Aucun nom, référence ou prescription n’est placé dans un journal.

Aucune migration supplémentaire : Preview reste à 36 migrations. Les drapeaux de production et Preview restent désactivés.

## Vérifications

- **667 tests serveur** réussis, 68 fichiers en 61,83 s ; **21 tests ciblés** repris après les derniers contrôles et la pagination bornée.
- **15 tests du domaine IA** réussis, dont compatibilité des choix communs, choix daté vide et refus des doublons/dates hors période.
- **218 tests natifs** réussis dans 31 fichiers. Ils ne remplacent pas une recette interactive de ces nouveaux écrans.
- Types du monorepo réussis ; lint des services/routes/tests modifiés sans erreur. Contrôle de design : aucun travers détecté.
- Exports Hermes iOS et Android réussis, route de planification incluse. Aucun nouveau module natif ajouté dans ce lot ; le binaire audio 1.1.0 a été compilé au lot précédent.
- Build de production et deux parcours navigateur desktop/mobile : **2 réussis en 32,8 s**. L’IA désactivée est absente de la capacité annoncée, ses appels sont refusés sans ligne de quota/résultat, et le constructeur manuel permet toujours création, publication et réouverture. Base E2E jetable séparée et supprimée ; base du simulateur conservée, API 3102 relancée et réponse HTTP 200 vérifiée.
- CI du prédécesseur `419b4ca` : Android `42451827542` et qualité `42451827556` réussis, Preview Vercel prête. La CI du présent lot doit être observée après le push.

## Limites de preuve

Le Mac verrouillé empêchait le contrôle visuel du simulateur lors du dernier essai. Aucun parcours de dictée humaine, VoiceOver/TalkBack ou iPhone/Android physique n’est déclaré réussi ici. Les contrôles de types, exports, règles de design et tests serveur ne prouvent pas cette expérience. Les passes UI/UX et la recette globale restent ouvertes ; le composant natif doit notamment être exercé avec une vraie interruption, une réponse perdue et une correction de proposition.

À terminer : interface et dictée web, recette interactive de reprise des propositions privées, alias contrôlés de bibliothèque, corpus d’au moins 60 cas dont 30 dictées, suivi du nombre de corrections, validation du traitement prestataire et bêta sur coachs. L’IA reste désactivée et la PR #45 reste en brouillon.


## Reprise privée après fermeture — 8 novembre, lot suivant `18a541c`

Route `GET /api/v1/orgs/:orgId/planner/proposals` et SDK partagé. Vingt demandes au maximum par page, ordre stable par date et identifiant, curseur limité à l’auteur et à l’espace. Les demandes expirées sont exclues même avant le cron de purge. Les destinataires sont recontrôlés : une proposition dont le groupe ou l’athlète n’est plus accessible est masquée. Une page filtrée peut être vide ; son curseur permet de continuer sans bloquer les autres demandes. Aucune consigne, transcription, note, prescription, aucun nom de destinataire ni contenu d’interprétation n’est sélectionné ou renvoyé par cette liste. Aucun appel prestataire, écriture ou consommation.

Entrée « Mes propositions récentes » avant le formulaire natif. Les cartes montrent période, date d’envoi et état ; l’ouverture relit la proposition au serveur. L’état « Traitement à vérifier » n’affirme pas qu’une opération interrompue tourne encore : la lecture détaillée résout le bail. Les précisions envoyées mais pas encore confirmées restent visibles et sélectionnables. Les saisies et ajustements non envoyés ne sont pas récupérables ; l’interface le précise. La liste reste en mémoire et n’est pas ajoutée au cache persistant. Aucun délai de conservation n’est prolongé.

Preuves locales : **23 tests serveur/API réussis en 7,14 s**, incluant pagination avec dates identiques, exclusion des autres auteurs/espaces et des demandes expirées, révocation des accès, coupure IA et absence de consommation supplémentaire. Types du monorepo réussis après correction du typage JSON d’une fixture. Lint ciblé sans erreur, contrôle design sans travers, exports Hermes iOS et Android réussis avec la nouvelle route. Aucun test de redémarrage interactif ni téléphone physique revendiqué.

Le simulateur iPhone 17 Pro était démarré ; l’application a été relancée avec succès (`simctl`, PID 68285). Le contrôle visuel a de nouveau signalé le Mac verrouillé. API locale 3102 et Metro 8083 conservés. La CI de `18a541c` était encore en cours pendant ce lot ; les résultats d’anciens commits ne valent pas validation du nouveau diff.
