# Parcours d'arrivée du coach et de l'athlète

Ce que vit un nouvel utilisateur, de l'inscription à sa première action utile. Le critère du produit : un coach publie une première séance en quelques minutes, un athlète valide en moins de 10 secondes. Le niveau de preuve est dans [../ETAT.md](../ETAT.md).

## Le coach, aujourd'hui

1. `/connexion?creer=1` : inscription, puis e-mail de vérification.
2. `/bienvenue` : contrôle de l'âge et de l'ouverture des inscriptions. Inscriptions fermées : écran d'attente.
3. Un formulaire unique (`apps/web/src/features/onboarding/onboarding-form.tsx`) crée l'espace en offre Découverte, avec la bibliothèque d'exercices, des modèles de séance (`packages/domain/src/starter-library.ts`, `starter-templates.ts`) et un premier groupe. Un compte ne possède qu'un espace gratuit.
4. Arrivée sur `/suivi`, ou sur `/abonnement` si le coach venait de `/tarifs`.
5. E-mail de bienvenue.

Rien ne guide ensuite : le coach trouve des états vides.

## Le coach, après le lot A9

**Trois temps au lieu d'un formulaire**, sur la même action serveur. Chacun peut être passé.

| Temps | Contenu |
| --- | --- |
| 1. À vos marques | Nom de l'espace, disciplines, logo facultatif |
| 2. Prêts | Premier groupe, puis invitation par lien, QR ou adresses collées |
| 3. Partez | Première séance à partir d'un modèle, publication |

**Liste « Premiers pas » sur `/suivi`**, présentée en tour de piste et refermable. Les étapes ne sont pas stockées : elles se déduisent de l'état réel de l'espace (`packages/domain/src/onboarding.ts`, `apps/web/src/server/onboarding.service.ts`).

| Étape | Faite quand |
| --- | --- |
| Inviter un athlète | Une invitation existe ou un athlète a rejoint |
| Créer une séance | Une séance existe |
| Publier | Une séance est publiée |
| Recevoir une première validation | Un athlète a validé |

Deux dates sont gardées sur l'espace, la fermeture de la liste et sa complétion, pour cesser de la calculer et mesurer l'activation sous 7 jours. Les e-mails d'activation s'appuient sur la même fonction : voir [emails.md](emails.md).

## L'athlète, aujourd'hui

1. Invitation nominative par e-mail, lien de groupe ou QR. Le coach peut renvoyer, révoquer, régénérer.
2. `/i/[token]` : création du compte, acceptation des conditions, accords santé et vidéo facultatifs et propres à la fiche. Le plafond d'athlètes de l'offre est contrôlé à ce moment.
3. Arrivée dans l'application.

Retirer l'accord santé efface les données de santé. Le parcours des mineurs est dormant.

## L'athlète, après le lot A11

Après l'acceptation, trois écrans courts, tous passables, en moins de 30 secondes.

| Écran | Contenu |
| --- | --- |
| Bienvenue | Signée du coach, avec le nom du groupe |
| Installer | Ajout à l'écran d'accueil, avec la marche à suivre de l'appareil |
| Notifications | Demandées par un bouton explicite, jamais à l'ouverture |

Puis la première séance, ou un état vide qui dit quand elle arrivera. Si une séance est due, elle passe devant ces écrans. Un e-mail de bienvenue reprend les mêmes repères.

## Ce qui se mesure

Indicateurs du pilote, dans [commercialisation.md](../plans/commercialisation.md) : activation sous 7 jours, taux et délai de validation, athlètes actifs.
