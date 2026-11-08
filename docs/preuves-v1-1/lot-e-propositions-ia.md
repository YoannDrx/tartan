# Propositions IA, clarifications et création de brouillons

8 novembre 2026, lot construit depuis `a626202`, PR #45 en brouillon. Migration additive `20261108080000_ai_planner_proposals`.

## Fonctionnement vérifié

Une demande relue est enregistrée avec sa sélection, les références de bibliothèque et de phase, sa version et un identifiant de rejeu. Le contexte envoyé au modèle utilise des jetons de destinataires ; les noms connus sont remplacés dans les consignes. Les blessures, notes privées, mesures de santé et maxima individuels ne sont pas sélectionnés pour ce contexte. La pseudonymisation ne garantit pas l'anonymat d'un texte libre : le coach devra être informé avant son envoi.

Les réponses sont validées par le contrat et le domaine. Une clarification conserve la proposition d'origine ; cinq échanges utilisables sont inclus sans nouvelle consommation de proposition. Échecs et réponses perdues sont repris sans double consommation. L'appel fournisseur reste en dehors des transactions SQL ; droits, bibliothèque, fuseau, phases et versions sont recontrôlés lors de l'enregistrement.

La confirmation explicite crée jusqu'à quatorze brouillons dans une même transaction. Elle réutilise les validations du constructeur, les prescriptions et les contextes de phase. Aucun brouillon n'est publié ni notifié. Deux confirmations simultanées produisent le même lot ; un contenu modifié sous le même identifiant est refusé. La relecture autorise les corrections du coach, avec revalidation des exercices, destinataires et dates.

Les propositions abandonnées expirent au plus tard sept jours après la demande initiale. Les textes et échanges d'une proposition confirmée expirent sous 24 heures, sans prolonger une échéance antérieure. Le cron purge même lorsque l'IA est désactivée. La suppression du compte supprime les propositions privées ; les brouillons validés restent des séances de l'espace.

## Preuves

- 13 tests de workflow : concurrence, réponse perdue, cinq clarifications, échec puis reprise, révocation, isolation entre auteurs/espaces, changement de bibliothèque, phases ambiguës, absence de notes privées dans le contexte, confirmation atomique, refus de publication implicite, purge et suppression du compte.
- 50 tests ciblés réussis ; **621 tests serveur réussis** dans 63 fichiers, en 53,26 s. Types du monorepo et lint ciblé réussis.
- Migration sur ancien schéma synthétique : 34 → 35 en **0,024 s** ; ancien espace, 24 exercices et réservation IA conservés. Base dédiée supprimée après contrôle.
- Preview Neon `br-floral-sun-b9iar8ge` : 34 → 35 en **3,51 s** ; zéro compte/proposition, droits du rôle applicatif vérifiés sur les trois tables IA, aucun flag activé. Production non ciblée. Base locale du simulateur également migrée.
- Premier appel réel OpenAI effectué le **8 novembre à 04:45:32 UTC**, modèle configurable `gpt-4.1-mini`, durée **4,888 s** : une consigne entièrement fictive de squat 3 × 4 × 40 kg, repos 120 s, date et groupe explicites. Sortie structurée acceptée et valeurs exactes vérifiées. Aucun texte personnel, audio ou accès en écriture à la base dans ce test ; aucune clé affichée ou committée.

## Limites et déploiement

Ce lot ajoute les services serveur, sans interface ni endpoint de planification. Transcription, contrôles de rythme, SDK, écrans web/natifs, corpus de soixante cas dont trente dictées et validation juridique restent à terminer. Un seul appel modèle réussi ne valide ni toutes les ambiguïtés ni la dictée.

Les migrations doivent précéder le code, car le cron utilise la table même IA désactivée. Retour arrière applicatif : conserver les tables additives ; ne pas effacer les consommations. La durée de conservation chez le fournisseur dépend de la configuration effective et reste à vérifier séparément de la purge Tartan et de `store:false`.
