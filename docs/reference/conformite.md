# Conformité : référence des traitements

Le fondateur déclare le 13 novembre 2026 la validation du dossier existant par son juriste (HDS, rôles RGPD, analyse d'impact, transferts, santé, vidéo, conservation, CGV et e-mails). L'avis et ses annexes restent hors de ce dépôt public ; aucune conclusion détaillée absente de cet avis n'est inventée ici. La signature effective des accords prestataires reste à confirmer. Les nouveaux médias et le partage vidéo au groupe requièrent une vérification ciblée des ajouts.

## Responsable de traitement

Yodev, Yoann Andrieux, entrepreneur individuel, SIREN 803 272 590. Contact : hello@tartan.coach.

Les rôles de responsable de traitement et de sous-traitant suivent l'avis validé conservé hors dépôt ; les mentions et contrats doivent rester cohérents avec celui-ci.

## Registre des traitements

| Traitement                             | Données                                                                                                                                     | Personnes                    | Base envisagée                                                | Durée en place                                                                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compte et connexion                    | E-mail, nom, date de naissance, photo, sessions                                                                                             | Coachs, athlètes             | Contrat                                                       | Jusqu'à la suppression du compte                                                                                                                                                          |
| Entraînement                           | Séances, validations, charges, tests, records                                                                                               | Athlètes                     | Contrat                                                       | Tant que l'athlète reste dans l'espace                                                                                                                                                    |
| Carte de record                        | Prénom, discipline, marque, date d'un record battu, en image                                                                                | Athlètes                     | Contrat ; partage à l'initiative de l'athlète                 | Générée à la demande, jamais conservée par Tartan                                                                                                                                         |
| Présence et absence                    | Réponse « je viens » ou « je ne viens pas », motif facultatif en liste fermée (travail, études, transport, famille, autre), jamais de santé | Athlètes                     | Contrat                                                       | Avec la séance ; la notification au coach ne porte pas le motif                                                                                                                           |
| Santé                                  | Blessures, douleurs, effort ressenti                                                                                                        | Athlètes                     | Consentement explicite, art. 9                                | Jusqu'au retrait ou à la suppression                                                                                                                                                      |
| Vidéos                                 | Gestes sportifs filmés, annotations                                                                                                         | Athlètes majeurs             | Consentement                                                  | Selon l'offre : 30 jours, 1 an, 3 ans                                                                                                                                                     |
| Notifications                          | Jeton d'appareil, texte neutre                                                                                                              | Tous                         | Intérêt légitime                                              | Jusqu'à la déconnexion                                                                                                                                                                    |
| Facturation                            | Client Stripe, abonnement                                                                                                                   | Coachs                       | Contrat, obligation légale                                    | 10 ans pour les factures                                                                                                                                                                  |
| Parrainage                             | Code, attribution                                                                                                                           | Coachs, athlètes majeurs     | Intérêt légitime                                              | Durée du compte                                                                                                                                                                           |
| Journaux                               | Événements techniques, accès santé                                                                                                          | Tous                         | Intérêt légitime                                              | 1 an pour les accès sensibles                                                                                                                                                             |
| Suivi d'erreurs (si Sentry est activé) | Message et pile d'erreur, sans utilisateur ni corps de requête                                                                              | Tous                         | Intérêt légitime                                              | Selon Sentry                                                                                                                                                                              |
| Planificateur IA                       | Demandes et dictées du coach, brouillons de séance                                                                                          | Coachs                       | Contrat, accord préalable à l'envoi vers OpenAI               | Transcription : 24 h ; proposition abandonnée : 7 jours ; proposition confirmée : 24 h après création des brouillons. Aucun audio conservé par Tartan ; rétention OpenAI selon le contrat |
| E-mails                                | Adresse, type de message, rebonds et plaintes                                                                                               | Tous                         | Contrat ; intérêt légitime pour les conseils, avec opposition | Durée du compte ; liste de blocage conservée                                                                                                                                              |
| Mesure d'audience                      | Pages vues, sans cookie ni identifiant                                                                                                      | Visiteurs                    | Intérêt légitime, à confirmer                                 | Selon Vercel                                                                                                                                                                              |
| Sauvegardes                            | Copie chiffrée de la base                                                                                                                   | Tous                         | Intérêt légitime, sécurité                                    | 30 jours                                                                                                                                                                                  |
| Signalements                           | Contenu signalé, auteur, décision                                                                                                           | Membres d'un espace          | Obligation légale, intérêt légitime                           | Durée du compte                                                                                                                                                                           |
| Jeu du site : classement (J3)          | Pseudo, score, date, empreinte salée d'appareil, empreinte salée d'adresse IP                                                               | Visiteurs, mineurs possibles | Intérêt légitime, relu par le juriste le 12 novembre 2026     | Empreinte IP : 30 jours ; jetons d'essai : un jour ; scores : jusqu'à effacement par l'appareil ou masquage par la console                                                                |

## Sous-traitants

| Prestataire      | Rôle                          | Localisation à vérifier                                                               | Contrat à signer ou accepter     |
| ---------------- | ----------------------------- | ------------------------------------------------------------------------------------- | -------------------------------- |
| Vercel           | Hébergement, images           | États-Unis, région Francfort pour les fonctions et les images                         | DPA                              |
| Neon             | Base de données               | Francfort                                                                             | DPA                              |
| Mux              | Vidéo                         | États-Unis                                                                            | DPA                              |
| Resend           | E-mails                       | États-Unis ou UE                                                                      | DPA                              |
| Expo             | Notifications mobiles         | États-Unis                                                                            | DPA                              |
| Stripe           | Paiement web                  | UE, États-Unis                                                                        | DPA inclus aux conditions        |
| Vercel Analytics | Mesure d'audience sans cookie | États-Unis                                                                            | Inclus au DPA Vercel, à vérifier |
| Sentry           | Suivi d'erreurs               | Région Allemagne                                                                      | DPA                              |
| OpenAI           | Planificateur IA              | États-Unis, journaux de contrôle jusqu'à 30 jours                                     | DPA, à vérifier                  |
| GitHub           | Copie de sauvegarde           | États-Unis, chiffrée avant envoi, clé gardée par l'éditeur. Dépôt public : à déplacer | DPA, à confirmer avec le juriste |

YouTube et Instagram ne sont pas des sous-traitants : les vidéos de la bibliothèque commune restent chez eux et Tartan n'en garde que la référence et l'auteur. Le lecteur Instagram ne charge qu'au clic, avec une mention. Le lecteur YouTube passe par `youtube-nocookie.com`.

Le suivi des accords signés (date, version, lieu de conservation) se tient hors de ce dépôt, avec le dossier remis au juriste. `docs/ETAT.md` n'en garde que l'état : signé ou non.

## Analyse d'impact

Tartan traite des données de santé (blessures, douleurs, effort ressenti) et des vidéos de personnes identifiables. Le fondateur inclut l'analyse d'impact dans le dossier validé le 13 novembre ; conserver son résultat et ses justifications hors dépôt et l'actualiser lors des nouveaux traitements. Elle décrit les traitements, leur nécessité, les risques pour les personnes et les mesures : consentement par fiche, effacement au retrait, journal des accès santé, absence de donnée de santé dans les journaux, les notifications et les e-mails.

## Exercice des droits

| Droit               | Comment il s'exerce aujourd'hui                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| Accès, portabilité  | Export depuis Réglages ; export de l'espace pour un propriétaire                                  |
| Rectification       | Réglages ; la date de naissance se corrige par le support                                         |
| Effacement          | Suppression du compte depuis Réglages ou `/suppression-compte` ; retrait de la fiche par le coach |
| Retrait d'un accord | Accords santé et vidéo, par fiche, depuis l'application                                           |
| Opposition          | Désinscription des e-mails ; refus du planificateur IA                                            |

Une demande reçue par e-mail est traitée sous un mois, après vérification que l'adresse est celle du compte. Le déroulé côté support est dans [support.md](../exploitation/support.md). La conduite en cas de fuite est dans [incident.md](../exploitation/incident.md).

## Ajout F6 à faire relire séparément

Le dépôt d'une vidéo par l'athlète la rend accessible à lui-même et à ses coachs habilités. Il ne la publie pas dans la bibliothèque commune. L'athlète peut choisir les groupes de son espace qui pourront la consulter et confirme ce partage dans une fenêtre dédiée ; les coachs ne peuvent pas ouvrir ce partage à sa place. Le retrait du partage, du groupe ou de l'espace refuse les nouveaux accès. Une URL de lecture déjà délivrée peut rester valide jusqu'à une heure ; ce délai est annoncé avant confirmation. Le retrait de l'accord vidéo ferme aussi l'accès des autres athlètes ; la suppression différée existante reste applicable.

À confirmer pour ces seuls ajouts : information sur les destinataires des commentaires et réponses, portée de l'accord vidéo pour le partage volontaire au groupe, et délai résiduel des liens signés. Le dossier antérieur validé ne vaut pas validation automatique de ces nouveautés. Vérification technique réelle Mux et revue juridique ciblée restent distinctes.

## Questions du dossier existant, déclarées validées le 13 novembre

Les questions ci-dessous conservent le périmètre du dossier relu. Elles ne sont plus une liste de treize validations en attente ; l'avis détaillé fait foi. La validation juridique ne prouve pas l'adhésion à un médiateur ni la signature des DPA.

1. **HDS** : un outil de coaching sportif qui garde blessures et douleurs relève-t-il de la certification ?
2. **Mux** : un hébergement de vidéos d'athlètes aux États-Unis est-il acceptable, avec quelles garanties ? Sinon, faut-il changer de prestataire avant d'ouvrir ?
3. **Retrait de l'accord vidéo** : aujourd'hui, l'image est masquée au coach aussitôt, puis la vidéo est supprimée par une tâche quotidienne sous 30 jours. Ce délai convient-il ?
4. **Départ d'un athlète** : aujourd'hui, sa fiche et ses données d'entraînement dans l'espace sont supprimées. Est-ce la bonne règle, ou faut-il une anonymisation ?
5. **Cache hors ligne du coach** : le téléphone du coach garde les pages de suivi, avec effort et douleur, jusqu'à la déconnexion. Faut-il le réduire ?
6. **E-mail de repli** : texte neutre, sans donnée de santé, désactivable dans les préférences. Est-ce suffisant ?
7. **CGV** : plafonds de l'offre Club, préavis de 14 jours avant retrait des vidéos, droit de rétractation d'un professionnel ou d'un consommateur.
8. **Bénévole de club** : un coach bénévole est-il un consommateur (médiateur obligatoire) ?
9. **Vidéos de tiers** : la bibliothèque commune intègre 24 vidéos publiques d'autres auteurs dans un service payant, sans les copier. Est-ce permis sans leur accord ? Une copie de secours, puis une diffusion si le lien disparaît, l'est-elle ? Une de ces vidéos montre un enfant : faut-il la retirer ?
10. **Jeu public** : le site propose un jeu avec classement public et pseudo, sans compte, accessible à des mineurs alors que l'application est réservée aux majeurs. Quelles mentions, quelle base légale, quelle durée de conservation ? L'empreinte d'adresse IP gardée 30 jours contre les abus est-elle acceptable ? **Réponse** : le fondateur rapporte le 12 novembre 2026 que le juriste a relu et donné son accord ; la mention est ajoutée à la politique de confidentialité (« Le jeu du site »).
11. **E-mail de reconquête** : un message unique, trente jours après la fin d'un abonnement, relève-t-il de la prospection permise envers un ancien client ? Même question pour les e-mails de conseils pendant l'essai.
12. **Analyse d'impact** : est-elle requise, et qui la rédige ?
13. **Suppression après 24 mois d'inactivité** : la politique de confidentialité la présente déjà comme une règle. Faut-il la retirer du texte en attendant la validation ?

## Médiateur

Recommandation : CM2C, 48 € pour 3 ans jusqu'à 10 personnes, 36 € par litige à distance ([tarifs](https://www.cm2c.net/tarifs.php), [inscription](https://www.cm2c.net/inscription-professionnel.php)). Référencement à revérifier sur la liste officielle, restée inaccessible lors du relevé. Une fois l'adhésion faite, remplacer le repère `[À DÉFINIR]` de `apps/web/app/(public)/cgv/page.tsx`.

## Comptes de stores

Formulaires et fiches : voir [fiches-stores.md](fiches-stores.md).
