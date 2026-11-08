# Lot E — parcours web du planificateur, 8 novembre 2026

État : parcours raccordé sur desktop et web mobile dans la PR 45. Drapeau global désactivé par défaut ; aucune activation en production. Ce document complète les preuves de capture audio et de parcours natif. La recette utilise la branche `codex/v1-1-progression`, après `34f2070` ; le commit qui ajoute ce document porte le code décrit.

## Parcours livré

Le calendrier transmet la date et le groupe sélectionnés. Le coach choisit les destinataires, une période de sept jours au maximum, la bibliothèque autorisée et, si nécessaire, les phases de chaque date. La consigne peut être écrite ou dictée ; sa relecture est explicite. Les clarifications, hypothèses et suggestions restent visibles séparément. La page conserve l’identifiant de proposition dans son URL et propose une liste privée de reprise, sans mettre la transcription dans un stockage persistant du navigateur.

La revue permet de corriger date, horaire, destinataires, format, prescriptions et intensité RPE/RIR, distincte des kilogrammes. Remplacer un exercice exige une fiche autorisée et une confirmation qui annonce le retrait des adaptations de cet item. Les phases sont revalidées après modification. Le calcul des charges individuelles utilise les références serveur, affiche leur origine et les références manquantes, avec pagination et adaptations explicites. Une modification invalide la relecture et l’aperçu précédents.

La création utilise une demande stable et ne publie rien. Une réponse perdue donne accès à une vérification du résultat, sans nouvelle création automatique. Après fermeture et reprise, les liens de brouillons n’affichent pas comme titre confirmé l’ancien titre proposé par l’IA. La publication reste dans le constructeur manuel.

Le constructeur web partage désormais son éditeur de prescription avec cette revue et permet aussi la saisie facultative de RPE/RIR, sans conversion implicite vers les kilogrammes. Les pages serveur vérifient l’accès effectif au planificateur avant de charger son contexte. La liste date les propositions dans le fuseau de l’espace.

## Preuves navigateur

Deux parcours Chromium, desktop et mobile, réussis sur le build de production en 27,7 secondes : contexte de calendrier, clarification obligatoire, rechargement et reprise, aperçu de douze athlètes paginé, calcul de 80 % d’une référence de 100 kg, références manquantes, adaptation à 35 kg, modification RPE vers RIR, invalidation de la relecture et création après perte simulée de réponse. La base contient exactement une séance non publiée, avec la cible RIR et l’adaptation conservées. Réouverture depuis la liste privée vérifiée. Axe et absence de débordement horizontal contrôlés sur la revue.

L’interprétation et la clarification sont simulées à la frontière prestataire avec des données fictives. La lecture des propositions, les phases, les calculs, la préparation, la confirmation et les écritures de séances passent par les vraies API et une base locale jetable. Une fixture initiale interprétait un timestamp Postgres dans le fuseau du Mac : le serveur a correctement refusé cette version. La fixture utilise désormais UTC ; le contrôle serveur n’a pas été assoupli.

Deux autres parcours Chromium ont vérifié la capture audio avec le périphérique synthétique du navigateur : annulation sans envoi, pistes arrêtées, fichier WebM accepté par le serveur, remboursement du quota après échec du prestataire absent, puis affichage d’une transcription simulée exigeant relecture. Les clés OpenAI sont explicitement absentes de l’environnement Playwright. Cela ne mesure ni la qualité de transcription ni la compatibilité Safari.

Captures de la revue : [desktop](images/planner-review-desktop.png), [mobile](images/planner-review-mobile.png). Ce sont des captures intégrales à une position de défilement, avec la navigation fixe à cette position ; elles ne constituent pas une mesure de temps d’usage.

Le scénario IA désactivée passe aussi en desktop/mobile après ajout de contrôles sur le calendrier et les deux routes directes : aucun formulaire IA, création et publication manuelles réussies, aucune opération ni consommation IA créée. Cette répétition utilise le serveur de développement pour préserver le serveur natif ouvert ; la CI exécute le scénario sur build de production. Types du monorepo, lint ciblé et contrôle design réussis. Après les dernières corrections de libellés et de fuseau, les quatre scénarios de planification/dictée sont également repassés ensemble en 1,2 minute sur le serveur de développement, sans arrêter le serveur natif.

## Limites et suite

Les modifications de revue non envoyées restent en mémoire : avertissement de départ et de rechargement, sans promesse de récupération après arrêt du navigateur. Le retour arrière du navigateur n’est pas bloqué. Les propositions déjà reçues par le serveur restent récupérables pendant leur durée de conservation.

La recette physique iOS/Android, Safari, VoiceOver/TalkBack, les essais avec coachs, les alias contrôlés et le corpus de soixante cas dont trente dictées restent à terminer. Le parcours natif a été relancé sur le simulateur iPhone 17 Pro le 8 novembre ; le verrouillage du Mac empêche encore sa recette visuelle à cette étape. Ce lot ne vaut pas validation commerciale ou publication sur les stores.
