# Transcription récupérable, quotas audio et purge

8 novembre 2026, depuis `d1df20f`, PR #45 en brouillon. Migration additive `20261108090000_ai_planner_transcriptions`.

## Workflow livré

Les routes d'envoi multipart et de récupération sont disponibles dans le SDK commun au web et au natif. L'acteur, son rôle, son espace et les drapeaux sont vérifiés avant la lecture du fichier. L'envoi exige une confirmation explicite du traitement audio. La limite porte sur le flux reçu, même sans Content-Length fiable ; métadonnées inconnues, doublons et durées imposées par le client sont refusés. Le nom du fichier n'est ni stocké ni transmis au fournisseur.

Après inspection réelle de la durée, une réservation atomique porte les secondes calculées et une empreinte HMAC de la requête et de l'audio. Le fournisseur est appelé hors transaction. Le résultat texte et la consommation sont enregistrés ensemble après recontrôle des accès. Une demande concurrente observe le traitement en cours ; le résultat d'une réponse perdue se retrouve par identifiant sans nouvel appel. Un échec restitue le quota et le rejeu du même identifiant ne retranscrit pas l'audio. Une révocation ou un bail expiré interdit de conserver une réponse tardive.

Le texte brut ASR est privé à son auteur et conservé **au maximum 24 heures après la demande**, même s'il n'a pas été utilisé. Sa suppression reste active IA coupée et la suppression du compte l'efface en cascade. Le texte relu et corrigé entre séparément dans le cycle de proposition : sept jours au plus si abandonné, 24 heures au plus après création des brouillons. Aucun audio n'est archivé côté serveur, aucune publication n'est déclenchée par une transcription.

Le registre technique ne contient qu'une référence de résultat. Une consommation audio ne peut pas être confirmée avec une référence de proposition ; les compteurs d'espace restent cohérents lorsqu'un coach supprime son compte.

## Preuves

- **44 tests ciblés réussis** : workflow, upload, quotas, propositions et intégration SDK/routes/Postgres avec prestataires simulés. Ils couvrent notamment concurrence, perte de réponse, quota épuisé, refus avant lecture du corps, suppression de compte, purge et révocation pendant l'appel.
- Les premiers tests d'intégration ont détecté que le wrapper JSON consommait le multipart avant ses middlewares. La route audio utilise maintenant une entrée explicite avec le même traitement d'erreur partagé ; les refus 401/403 vérifient que le corps n'a pas été lu. Une erreur de fixture de rôle a également été corrigée.
- **662 tests serveur réussis**, 68 fichiers, 61,68 s. Types monorepo et lint ciblé réussis.
- **Deux parcours navigateur sur build de production réussis**, desktop et web mobile, en **30,3 s build compris**. Accès sans session refusé, IA désactivée refusée, aucune opération/consommation/transcription/proposition créée ; création, publication et réouverture d'une séance manuelle restent fonctionnelles. Cette recette utilisait une base jetable distincte, supprimée ensuite ; la base du simulateur a été conservée.
- Ancien schéma synthétique : 35 → 36 migrations en **0,042 s**, ancien espace et réservation IA conservés, 24 exercices inchangés. Preview Neon `br-floral-sun-b9iar8ge` : 35 → 36 en **3,25 s**, zéro compte/transcription, permissions applicatives vérifiées, aucun flag activé. Base locale du simulateur également migrée. Production non ciblée.
- API locale 3102 relancée après la recette ; `/connexion` répond 200. Aucune nouvelle validation visuelle native revendiquée.

## Limites et déploiement

Les interfaces web/natives et l'enregistrement `expo-audio` restent à implémenter, puis le corpus de dictées et les recettes physiques. Le succès réel de l'adaptateur sur une phrase synthétique est documenté séparément ; ce lot n'a fait aucun nouvel appel OpenAI payant et ne prétend pas valider le parcours vocal sur téléphone.

Migrer avant de déployer : le cron consulte la nouvelle table même IA désactivée. Retour arrière applicatif : conserver la table additive. Les durées de conservation distantes restent à examiner selon la configuration effective du fournisseur.
