# Parcours d'arrivée du coach et de l'athlète

Ce que vit un nouvel utilisateur, de l'inscription à sa première action utile. Le critère du produit : un coach publie une première séance en quelques minutes, un athlète valide en moins de 10 secondes. Le niveau de preuve est dans [../ETAT.md](../ETAT.md).

## Le coach

1. `/connexion?creer=1` : inscription, puis e-mail de vérification.
2. `/bienvenue` : contrôle de l'âge et de l'ouverture des inscriptions. Inscriptions fermées : écran d'attente.
3. Création de l'espace en trois temps (`apps/web/src/features/onboarding/onboarding-form.tsx`), sur une seule action serveur :

| Temps | Contenu | Requis |
| --- | --- | --- |
| 1. À vos marques | Prénom, nom, date de naissance | Oui |
| 2. Prêts | Club ou indépendant, nom de l'espace, premier groupe, objectif du groupe | Nom et groupe |
| 3. Partez | Disciplines, objectifs et matériel ; conditions d'utilisation | Conditions |

Chaque « Continuer » valide le temps affiché et porte le focus sur le titre du suivant. Entrée fait avancer d'un temps. Une erreur dans un temps précédent y ramène, comme « Corriger » sur la confirmation de la date. L'espace naît en offre Découverte, avec la bibliothèque d'exercices, des modèles de séance (`packages/domain/src/starter-library.ts`, `starter-templates.ts`) et son premier groupe. Un compte ne possède qu'un espace gratuit.

4. Arrivée sur `/suivi`, ou sur `/abonnement` si le coach venait de `/tarifs`.
5. E-mail de bienvenue.

### Le guide « Pour démarrer »

Sur `/suivi`, jusqu'à la première validation reçue. Les étapes ne sont pas stockées : elles se déduisent de l'état réel de l'espace, par une règle pure que les e-mails d'activation liront aussi (`packages/domain/src/onboarding.ts`). Les faits viennent de `onboardingProgress`, dans `apps/web/src/server/tracking.service.ts`.

| Étape | Faite quand | Mène à |
| --- | --- | --- |
| Inviter des athlètes | Une invitation existe ou un athlète a rejoint | Réglages, invitations |
| Créer une première séance | Une séance existe | Nouvelle séance |
| Publier la séance | Une séance est publiée | Calendrier |
| Recevoir une première validation | Un athlète a validé | Calendrier |

Une étape avancée prouve les précédentes : une séance supprimée après une validation ne fait pas reculer le guide. Le guide affiche le nombre d'étapes faites et marque la prochaine.

Reste à faire, hors du lot A9 : inviter et publier une première séance dès la création de l'espace, sans passer par les réglages ; refermer le guide à la main ; l'afficher en tour de piste (lot B3).

## L'athlète

1. Invitation nominative par e-mail, lien de groupe ou QR. Le coach peut renvoyer, révoquer, régénérer. Une invitation nominative sans réponse reçoit un seul rappel, trois jours plus tard.
2. `/i/[token]` : création du compte, acceptation des conditions, accords santé et vidéo facultatifs et propres à la fiche. Le plafond d'athlètes de l'offre est contrôlé à ce moment.
3. E-mail de bienvenue, à la première arrivée dans l'espace.
4. Arrivée sur `/aujourdhui`.

Retirer l'accord santé efface les données de santé. Le parcours des mineurs est dormant.

### L'accueil sur `/aujourdhui`

Pendant la première semaine, et jusqu'à la première séance validée, un encart nomme le groupe et le coach qui le suit, et dit en une phrase ce qui va se passer ici (`apps/web/src/features/athlete-view/athlete-welcome.tsx`, `getAthleteWelcome` dans `athlete-view.service.ts`). Il se referme d'un geste, sur l'appareil.

- Une séance du jour passe devant : l'encart ne s'affiche pas tant qu'il y a une séance à faire.
- L'installation sur l'écran d'accueil et les notifications ne sont pas un écran de plus : l'encart déclenche tout de suite le bandeau existant (`install-banner.tsx`), qui attendait jusque-là une première action utile. Les notifications se demandent toujours par un bouton, jamais à l'ouverture.

## Ce qui se mesure

Indicateurs du pilote, dans [commercialisation.md](../plans/commercialisation.md) : activation sous 7 jours, taux et délai de validation, athlètes actifs.
