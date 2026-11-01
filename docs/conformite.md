# Conformité : dossier à relire avec un juriste

Brouillon préparé d'après ce que l'application fait réellement, pour gagner du temps à la relecture (§ 15 du cahier). Ce n'est pas un avis juridique. Tant qu'il n'est pas relu, les pages légales gardent la mention « version de travail ».

## Responsable de traitement

Yodev, Yoann Andrieux, entrepreneur individuel, SIREN 803 272 590. Contact : hello@tartan.coach.

Rôle à faire confirmer : Yodev est-il responsable de traitement, ou sous-traitant du coach ou du club pour les données de ses athlètes ? La réponse change les contrats et les mentions.

## Registre des traitements

| Traitement                             | Données                                                        | Personnes                 | Base envisagée                    | Durée en place                         |
| -------------------------------------- | -------------------------------------------------------------- | ------------------------- | --------------------------------- | -------------------------------------- |
| Compte et connexion                    | E-mail, nom, date de naissance, photo, sessions                | Coachs, athlètes          | Contrat                           | Jusqu'à la suppression du compte       |
| Entraînement                           | Séances, validations, charges, tests, records                  | Athlètes                  | Contrat                           | Tant que l'athlète reste dans l'espace |
| Santé                                  | Blessures, douleurs, effort ressenti                           | Athlètes                  | Consentement explicite, art. 9    | Jusqu'au retrait ou à la suppression   |
| Vidéos                                 | Sauts filmés, annotations                                      | Athlètes, souvent mineurs | Consentement                      | Selon l'offre : 30 jours, 1 an, 3 ans  |
| Mineurs de moins de 15 ans             | Toutes les données ci-dessus                                   | Athlètes, un parent       | Accord d'un parent et de l'enfant | Comme ci-dessus                        |
| Notifications                          | Jeton d'appareil, texte neutre                                 | Tous                      | Intérêt légitime                  | Jusqu'à la déconnexion                 |
| Facturation                            | Client Stripe, abonnement                                      | Coachs                    | Contrat, obligation légale        | 10 ans pour les factures               |
| Parrainage                             | Code, attribution                                              | Coachs, athlètes majeurs  | Intérêt légitime                  | Durée du compte                        |
| Journaux                               | Événements techniques, accès santé                             | Tous                      | Intérêt légitime                  | 1 an pour les accès sensibles          |
| Suivi d'erreurs (si Sentry est activé) | Message et pile d'erreur, sans utilisateur ni corps de requête | Tous                      | Intérêt légitime                  | Selon Sentry                           |

## Sous-traitants

| Prestataire | Rôle                  | Localisation à vérifier                                       | Contrat à signer ou accepter                       |
| ----------- | --------------------- | ------------------------------------------------------------- | -------------------------------------------------- |
| Vercel      | Hébergement, images   | États-Unis, région Francfort pour les fonctions et les images | DPA                                                |
| Neon        | Base de données       | Francfort                                                     | DPA                                                |
| Mux         | Vidéo                 | États-Unis                                                    | DPA, à regarder de près pour les vidéos de mineurs |
| Resend      | E-mails               | États-Unis ou UE                                              | DPA                                                |
| Expo        | Notifications mobiles | États-Unis                                                    | DPA                                                |
| Stripe      | Paiement web          | UE, États-Unis                                                | DPA inclus aux conditions                          |
| RevenueCat  | Achats intégrés       | États-Unis                                                    | DPA                                                |
| Sentry      | Suivi d'erreurs       | Région Allemagne                                              | DPA                                                |

## Questions à poser au juriste

1. **HDS** : un outil de coaching sportif qui garde blessures et douleurs relève-t-il de la certification (§ 15.2) ?
2. **Mux** : un hébergement de vidéos de mineurs aux États-Unis est-il acceptable, avec quelles garanties ? Sinon, faut-il changer de prestataire avant d'ouvrir ?
3. **Retrait de l'accord vidéo** : aujourd'hui, l'image est masquée au coach sans être supprimée. Faut-il la supprimer, et sous quel délai ?
4. **Départ d'un athlète** : aujourd'hui, sa fiche et ses données d'entraînement dans l'espace sont supprimées. Est-ce la bonne règle, ou faut-il une anonymisation (§ 15.4) ?
5. **Cache hors ligne du coach** : le téléphone du coach garde les pages de suivi, avec effort et douleur, jusqu'à la déconnexion. Faut-il le réduire ?
6. **E-mail de repli** : texte neutre, sans donnée de santé. Faut-il une option pour le couper dès la V1 ?
7. **CGV** : plafonds de l'offre Club, préavis de 14 jours avant retrait des vidéos, droit de rétractation d'un professionnel ou d'un consommateur.
8. **Bénévole de club** : un coach bénévole est-il un consommateur (médiateur obligatoire) ?

## Médiateur

Recommandation : CM2C, 48 € pour 3 ans jusqu'à 10 personnes, 36 € par litige à distance ([tarifs](https://www.cm2c.net/tarifs.php), [inscription](https://www.cm2c.net/inscription-professionnel.php)). Référencement à revérifier sur la liste officielle, restée inaccessible lors du relevé. Une fois l'adhésion faite, remplacer le repère `[À DÉFINIR]` de `apps/web/app/(public)/cgv/page.tsx`.

## Comptes de stores

Formulaires et fiches : voir `docs/fiches-stores.md`.
