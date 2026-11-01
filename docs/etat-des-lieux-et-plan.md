# Tartan : état des lieux et plan

Relevé du 1er novembre 2026, sur la branche `feat/sprint-0-fondations`, au regard du cahier des charges v1.5.

Niveau de preuve de chaque constat :

- **[vu]** : constaté directement (commande, API, base, capture, code relu).
- **[relu]** : signalé par une relecture indépendante du code, sans exécution. À reproduire avant correction.
- **[appareil]** : impossible à trancher sans un vrai téléphone.

## 1. Verdict

**Tartan n'est pas terminé, et rien de ce qui a été fait depuis ce matin n'est en ligne.**

- La production tourne sur `ed209ae`, sans l'identité rouge, sans `/tarifs`, sans `/abonnement`, sans vente. [vu]
- Le travail récent existe seulement en local : 2 commits non poussés et 157 fichiers modifiés ou nouveaux, non commités. [vu]
- Sur le web, en ligne, la V1 du pilote est largement construite. Elle n'a jamais été éprouvée sur un vrai téléphone ni par un vrai athlète. [vu]
- L'app mobile compile, mais elle n'est pas soumissable. [relu]
- La vente n'est pas prête : 5 défauts de facturation, clé Stripe de test en production. [vu et relu]
- Il n'existe aucun tableau de bord d'administration. [vu]

### Contrôles lancés

| Contrôle | Résultat |
| --- | --- |
| Types web et mobile | sans erreur |
| Lint web | 0 erreur, 4 avertissements |
| Tests `domain` | 50 sur 50 |
| Tests web, sur Postgres réel | 107 sur 107 |
| Tests mobile | 54 sur 54 |
| Détecteur de travers `design:check` | 0 |
| Playwright sur build de production | 21 réussis, 7 ignorés |
| Preuve de concept vidéo web, en développement | réussie |

**Limite de ces chiffres :** le parcours complet simule déjà l'athlète sur téléphone, mais le coach seulement sur ordinateur. Rien ne vérifie le coach au bord de la piste, ni un vrai navigateur iPhone. Aucun test ne couvre le paiement réel.

## 2. Production et services

| Service | État réel | Conséquence | Preuve |
| --- | --- | --- | --- |
| Vercel | Plan Pro, `ed209ae` déployé | Le plan permet l'usage commercial et le cron horaire | [vu] |
| Webhook Mux | 837 erreurs en 7 h : le secret a été ajouté après le dernier déploiement | La vidéo ne marche pas en production avant un redéploiement | [vu] |
| Mux | **Offre gratuite : 10 vidéos au plus**, logo Mux sur le lecteur | Inutilisable pour le pilote. Il faut ajouter une carte | [vu] |
| Neon | **Offre gratuite** : restauration sur 6 h, 1 Go, 0,25 CU, mise en veille | Le § 15.5 (sauvegardes quotidiennes, restauration testée) n'est pas tenu | [vu] |
| Base de production | 1 compte, 1 espace, 0 athlète. Migrations `offres_payantes` et `video_etiree` non appliquées | Sans risque aujourd'hui, à appliquer au déploiement | [vu] |
| Resend, DNS, domaines | En place | `www.tartan.coach` sert la page au lieu de rediriger vers le domaine nu | [vu] |
| Apple et Google (connexion) | Variables absentes en production | Boutons masqués | [vu] |
| Blob, RevenueCat produits | Variables absentes | Pas de photo de profil, pas d'achat intégré | [vu] |
| Suivi d'erreurs | Rien, à part les journaux Vercel | Les 837 erreurs ont passé 7 h sans alerte | [vu] |
| Fichiers de liens d'app | Servis, mais `TEAMID` fictif et empreintes vides | Liens universels inactifs | [relu] |

## 3. Stripe : pas correctement configuré

### Ce qui est en place [vu]

- Compte `acct_1MpyGWH4VwBfiTEI`, paiements et virements actifs, aucune exigence en attente.
- Produits `tartan_coach` et `tartan_club`, avec 4 prix en mode réel : 19 €, 190 €, 59 €, 590 €.
- Webhook de production actif et portail client dédié, résiliation en fin de période.

### Ce qui ne va pas

| # | Défaut | Conséquence | Preuve |
| --- | --- | --- | --- |
| S1 | La clé secrète de production est encore la clé **de test** du bac à sable Moodday. La clé réelle n'a pas été créée : Stripe attendait ta validation Touch ID | Prix réels et clé de test : tout paiement échouerait après le déploiement | [vu] |
| S2 | Le webhook reçoit la version d'API `2022-11-15` du compte, alors que le code lit `items.data[0].current_period_end`, champ de versions récentes | Date de fin d'abonnement vide en production. Les tests ne le voient pas | [vu] |
| S3 | Le portail autorise le changement de quantité | Un client peut acheter 3 × Coach | [vu] |
| S4 | Aucun pied de facture : pas de mention « TVA non applicable, art. 293 B » ni d'identité Yodev | Factures non conformes | [vu] |
| S5 | Nom public du compte : **Pressay**, relevé bancaire : YOANN ANDRIEUX | Seule la page de paiement affiche Tartan. Reçus, factures et relevés non | [vu] |
| S6 | « Choisir Club » alors qu'un abonnement existe en crée un second | Double prélèvement, puis repli en Découverte à la fin de l'ancien | [vu] |
| S7 | L'événement est marqué traité avant d'être appliqué | Une erreur de base fait perdre l'abonnement : le renvoi est ignoré | [vu] |
| S8 | Supprimer son compte ne résilie pas l'abonnement | Le client continue de payer un service disparu | [vu] |
| S9 | Produits et webhook de test restés dans le bac à sable Moodday, webhook pointant vers la production | Pollution, à nettoyer | [vu] |
| S10 | Statut `unpaid` : l'offre reste active sans fin ; mois offert du parrainage seulement sur Stripe | Abus possible, promesse partielle | [relu] |
| S11 | Aucun paiement de bout en bout n'a été joué | Rien ne prouve que le circuit marche | [vu] |

## 4. Failles à corriger avant tout utilisateur extérieur

| # | Gravité | Scénario | Preuve |
| --- | --- | --- | --- |
| F1 | Élevée | E-mail jamais vérifié : un tiers s'inscrit avec une adresse de la liste du pilote et obtient un espace gratuit, puis garde son mot de passe quand le vrai titulaire arrive par Google | [vu] `src/lib/auth.ts` |
| F2 | Élevée | Date de naissance laissée vide : un enfant de 13 ans consent seul, sans parent. Point juridique du § 15.3 | [vu] `accept-form.tsx`, `invitation.service.ts` |
| F3 | Moyenne | Un adjoint du groupe A passe `athleteId` et lit les vidéos du groupe B : le filtre écrase le contrôle | [vu] `video.service.ts`, `listVideos` |
| F4 | Moyenne | Un athlète lit via `/sessions/:id/coach` une séance de l'espace qui ne lui est pas attribuée | [relu] `tracking.service.ts` |
| F5 | Moyenne | Consentement vidéo révoqué : la lecture et le partage continuent | [relu] `video.service.ts` |
| F6 | Moyenne | Hors ligne, session expirée : la validation en file est effacée sans prévenir | [relu] `validation-queue.ts` |
| F7 | Moyenne | Compte à la fois coach et athlète : le lien de la notification ouvre la mauvaise page | [relu] `notify.service.ts` |
| F8 | Moyenne | Après déconnexion, l'appareil reçoit encore les notifications | [relu] `notify.service.ts` |
| F9 | Moyenne | La feuille de barres de la fiche mélange tous les jours, et aucune vidéo web n'est rattachée à la séance | [relu] `video.service.ts` |
| F10 | Faible | Invitations de coachs hors limite, push échoué marqué envoyé, pas de limite de débit sur commentaires et signalements | [relu] |

Point sain [relu] : aucune requête Prisma hors des services, webhooks signés, cron protégé, santé masquée dans la grille, le CSV et les notifications.

## 5. Couverture du cahier

| Module | V1 du pilote | Écarts |
| --- | --- | --- |
| M1 Comptes | OK | Langue absente du profil. Apple et Google à configurer |
| M2 Organisations | Partiel | Disciplines figées, **logo absent**. Coachs multiples OK |
| M3 Fiche athlète | OK | Objectifs en texte libre. Courbes (V2) absentes |
| M4 Exercices | Partiel | Envoi de vidéo coach sans progression ni erreur. Bibliothèque réelle à remplir avec ton frère |
| M5 Séances | OK | Volume calculé (V2) seulement dans les statistiques |
| M6 Calendrier | Partiel | Glisser-déposer à la souris, repli « Déplacer » au doigt. Saison (V2) absente |
| M7 Athlète | Partiel | Présence depuis la notification : ouvre une page, sans bouton, sur le web. Bilan du matin (V2) absent |
| M8 Suivi | OK | PDF (V2) absent |
| M9 Charge | V2 partielle | Statistiques de saut absentes |
| M10 Vidéo | Partiel | Voir ci-dessous. Dessin et comparaison (V2) absents |
| M11 Communication | Partiel | Signalements enregistrés, **lus par personne**, vidéo non signalable (§ 16.2) |
| M12 Notifications | Partiel | Regroupement absent, alerte « 2 manquées » sans push, préférences (V2) absentes |
| M13 Disciplines | Hauteur OK | Longueur, sprint (V2) absents |
| M14 Réglages | Partiel | Visibilité du profil absente. Anglais (V2) absent |
| RGPD | Partiel | Journal d'accès santé limité à la fiche, accord parental sans renvoi, registre et contrats à faire |
| Mesures d'usage | Partiel | Script à la main par espace. MRR, désabonnement et satisfaction absents |

Détail [relu]. Les écarts V2 déjà présents ou absents ne bloquent pas le pilote.

### La vidéo : le cahier repose sur une hypothèse fausse

Le § 11.5 prévoit « une version MP4 à pleine fréquence » chez Mux. Mesuré sur le vrai Mux [vu] : 240 et 120 i/s ressortent à **30 i/s**, aux trois niveaux de qualité, soit 7 images sur 8 perdues pour un 240 i/s. J'avais annoncé à tort que le test était bon : j'avais lu la métadonnée de Mux, pas le fichier.

Correctif en place en local : l'en-tête du fichier est réécrit avant l'envoi, sans réencodage, de façon que chaque image dure 8 fois plus. Vérifié [vu] sur MP4, MOV, HEVC, images B et son. Via le vrai Mux, le MP4 signé garde ses **720 images distinctes**. Le lecteur web tient le temps réel. MP4 fragmenté et fichier illisible : envoi tel quel, affiché honnêtement à 30 i/s.

Restent :

- **Mobile non branché** : un 240 i/s envoyé depuis l'app perd ses images, et une vidéo étirée y est lue 8 fois trop lentement. Une annotation créée sur mobile enregistre alors un temps faux. [relu] **Bloquant.**
- **Vrai ralenti iPhone** : le fichier fourni par la pellicule ou le sélecteur Safari reste à essayer. [appareil]
- **Coût** : voir § 9, 8 fois plus de minutes stockées.

## 6. Ton objectif : coachs et athlètes sur le web, sans store

**C'est faisable à court terme, et c'est prévu par le cahier (§ 10.1, § 16.3 étape 4).** Athlète et coach peuvent déjà, en ligne, au téléphone : de l'invitation à la première validation, consentements et accord parental, mode séance, appel, relance, import vidéo. [relu] Ce n'est pas encore en ligne, et ça n'a jamais été essayé sur un vrai téléphone.

| Besoin | Aujourd'hui | À faire |
| --- | --- | --- |
| Être en ligne | `ed209ae` | Déployer (phase 1) |
| Coach | Compte créé, puis « Tartan ouvre bientôt » s'il n'est pas sur la liste | Ajouter chaque coach à la liste, ou ouvrir |
| Installation | Manifeste présent, aucun guide | Guide d'installation après l'invitation, adapté à iPhone et Android |
| Hors ligne | **`sw.js` ne fait que le push : au stade sans réseau, aucune page ne s'ouvre** | Coquille en cache, 7 jours de séances, file persistante |
| File locale | Validations seulement, page ouverte | Présence, appel, essais, commentaires, en IndexedDB |
| Notifications | Activables dans Réglages seulement | Demande après l'invitation, attente de `serviceWorker.ready`, repli si `Notification` est absent |
| Vidéo | Sélecteur système, envoi sans reprise après fermeture | File persistante, reprise, rattachement à la séance |

### Ce que le web ne fera jamais aussi bien que l'app

- **iPhone : notifications seulement si le site est ajouté à l'écran d'accueil**, manuellement, depuis iOS 16.4. Sans ça, l'athlète ne reçoit rien ([Pushpad](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications)). C'est le vrai risque du pilote : le suivi repose sur cette notification. Parade : e-mail de séance en repli, et installation faite ensemble à la piste.
- **Répondre depuis la notification** : à tester sur iPhone ; je n'ai pas trouvé de source fiable. La validation passe donc par une page. Le but de 10 secondes reste atteignable en ligne, à mesurer.
- **Filmer à 240 i/s depuis le navigateur : non.** Le coach filme avec l'appareil photo puis importe. L'envoi peut s'interrompre quand Safari passe en arrière-plan. [appareil]

## 7. Design : la réponse honnête

| Surface | État | Preuve |
| --- | --- | --- |
| Écrans web existants | Passe faite avec les trois skills, axe sans violation sur 3 largeurs, **mais une passe globale, pas les 5 étapes écran par écran du § 9.12** | Rapport de l'agent |
| Écrans web écrits ensuite : tarifs, abonnement, mot de passe, membres, retrait d'athlète, charge, CSV, publication programmée | **Aucun skill.** Seuls tarifs, abonnement, suivi, réglages et Aujourd'hui ont été regardés en capture : le rendu tient | [vu] |
| App mobile | **Ni validée ni terminée.** L'agent s'est arrêté avant de rendre son rapport | [vu] |
| Vrais Safari, iPhone, Android | Jamais vérifié, alors que le § 9.11 l'exige | [vu] |
| Tableau de bord d'administration | **N'existe pas.** Le cahier n'en demande pas ; il cite juste « un administrateur » (§ 12.6) | [vu] |
| Production | Encore l'ancien design | [vu] |

Écarts repérés : capitales au-dessus des sections (« ATHLÈTE », « AU PROGRAMME »), interdites par le § 9.11, et `window.confirm` natif pour certaines suppressions. Le détecteur en CI est un script maison, là où le § 9.12 prévoit celui d'Impeccable.

## 8. Ce que je remets en question

1. **Vendre avant le pilote.** Le cahier est clair : pilote gratuit d'abord, 6 semaines, puis la vente en V2. Sa règle d'or préfère une V1 réduite et impeccable. Ta demande de la rendre commercialisable m'a fait construire la facturation avant qu'un seul athlète ait validé une séance. **Je recommande de la garder prête, mais coupée, jusqu'à la fin du pilote.** Les prix n'ont pas non plus été confrontés aux 10 à 20 coachs prévus au § 17.1.
2. **Mon choix du compte Stripe.** J'avais recommandé ton compte existant. Vu S5, je change d'avis : **un compte dédié Tartan**, sous la même entité. Nom public, relevé, reçus et factures seraient propres, et le script recrée tout en quelques minutes. À confirmer avec ton comptable pour la numérotation des factures.
3. **Le site promet trop.** « Pour les coachs de saut, de sprint et de haies », alors que le module sprint est V2. Tableau de parrain réduit, parrainage athlète absent. À retirer du site jusqu'à leur existence.
4. **Offre Club illimitée.** Vidéos illimitées et conservées sans limite à 59 € : coût sans plafond, vu l'étirement. Il faut une durée maximale par vidéo (prévue au § 19, jamais codée) et un plafond raisonnable.
5. **Le rouge plein écran.** Ta décision prime, mais elle contredit le § 9.11 (« clair pour planifier »). Blanc sur rouge passe à 4,99:1, sans marge. À tester en plein soleil, à la piste, avec ton frère, avant de la figer. Le cahier et `DESIGN.md` doivent aussi être alignés.
6. **Aucune console pour toi.** Le cahier n'en veut pas, mais tu ne verrais aujourd'hui ni tes clients, ni qui valide, ni les signalements, sauf en SQL. Apple attend qu'un signalement soit traité. **Une console minimale** me semble nécessaire ; Stripe suffit pour les revenus.
7. **Le test fermé Google n'attend pas la fin.** 12 testeurs, 14 jours : l'horloge doit partir tôt, même si le web porte le pilote (§ 16.3).
8. **Offres gratuites.** Mux et Neon gratuits ne tiennent pas un pilote. Ce sont les seules dépenses vraiment immédiates.
9. **Mon compte rendu d'étapes.** J'ai annoncé des choses comme faites alors qu'elles n'étaient que locales, ou vérifiées sur la mauvaise source (240 i/s). D'où la règle : **rien n'est « fait » tant que ce n'est pas vérifié en production** (phase 1 et suivantes).

## 9. Coûts à prévoir

| Poste | Montant | Quand |
| --- | --- | --- |
| Neon Launch | Sans minimum, environ 15 $/mois pour une petite base, restauration jusqu'à 7 jours ([Neon](https://neon.com/pricing)) | Phase 1 |
| Mux à l'usage | Carte requise, 20 $ de crédit mensuel et 100 000 minutes de lecture offertes ([Mux](https://www.mux.com/docs/changelog/video-free-plan)) | Phase 1 |
| Vercel Pro | Déjà payé | |
| Apple Developer | 99 $/an (§ 16.1, à vérifier) | Phase 5 |
| Google Play | 25 $ une fois (§ 16.1, à vérifier) | Phase 5 |
| Médiateur CM2C | 48 € pour 3 ans, 36 € par litige ([CM2C](https://www.cm2c.net/tarifs.php)) | Phase 6 |
| Juriste ou DPO | À chiffrer | Phase 6 |

**Coût vidéo, à vérifier sur la vraie facture :** stockage à partir de 0,0024 $/minute ([Mux](https://www.mux.com/docs/pricing/overview)). Un coach au maximum de l'offre (100 vidéos par mois, gardées 365 jours), avec des clips de 10 s à 240 i/s, stockerait 1 600 minutes, soit environ 3,84 $/mois, contre 0,48 $ sans étirement. Soutenable à 19 €, à condition d'un plafond de durée.

## 10. Plan

Principe : **web d'abord, pilote ensuite, stores en parallèle, vente en dernier.** Effort : S (moins d'une demi-journée), M (une journée environ), L (plusieurs jours). Ces ordres de grandeur sont des estimations.

Légende du responsable : **C** moi, **T** toi, **F** ton frère.

### Phase 0 : remettre le dépôt d'équerre

| Tâche | Qui | Effort | Terminé quand |
| --- | --- | --- | --- |
| Découper et commiter le travail local en commits lisibles, mobile à part | C | S | Arbre propre, CI verte |
| Finir la vérification des écrans ajoutés, supprimer le code mort du mobile | C | S | Lint et types sans nouvel avertissement |
| Remplacer `docs/lancement.md` par ce plan | C | S | Une seule liste à jour |

### Phase 1 : corriger et mettre en ligne sans vente

| Tâche | Qui | Effort | Terminé quand |
| --- | --- | --- | --- |
| F1 : e-mail vérifié avant tout droit, inscription par mot de passe comprise | C | M | Test : adresse de la liste non vérifiée, pas d'espace pilote |
| F2 : date de naissance obligatoire pour un athlète | C | S | Test : sans date, invitation refusée |
| F3 à F5 : contrôles d'accès, reproduits d'abord par un test | C | M | Tests rouges puis verts |
| F6 à F10 | C | M | Chaque scénario couvert ou écarté, avec preuve |
| Couper la vente en production : retirer `STRIPE_PRICE_*` ou clé de test, `/tarifs` sans paiement | C | S | Aucun achat possible ; message clair |
| Corriger les promesses du site, retirer sprint et haies | C | S | Texte conforme à l'existant |
| Passer Neon en Launch, restauration 7 jours, et jouer une restauration | T puis C | S | Restauration testée sur une branche |
| Ajouter une carte sur Mux | T | S | Plus de limite de 10 vidéos, plus de logo |
| Sentry avec alerte (le § 14 le prévoit « si besoin » : les 837 erreurs le justifient) | C | S | Erreur de test reçue |
| Déployer, appliquer les migrations, rediriger `www` | C | S | Webhook Mux sans erreur sur 24 h, vraie vidéo traitée |
| Recette en production : lien magique, invitation, validation, vidéo signée | C | M | Parcours joué sur `app.tartan.coach` |

### Phase 2 : la vraie web app (ton objectif)

| Tâche | Qui | Effort | Terminé quand |
| --- | --- | --- | --- |
| Service worker : coquille, séances des 7 prochains jours, page hors ligne | C | L | Mode avion : séance du jour lisible |
| File persistante en IndexedDB : validation, présence, appel, essais, commentaires ; session expirée sans perte | C | L | Valider hors ligne, fermer, revenir : la validation arrive |
| Vidéo web : file persistante, reprise, progression, durée maximale, rattachement à la séance | C | L | Coupure pendant l'envoi : reprise sans perte |
| Notifications web : demande après l'invitation, repli sans `Notification`, espace dans le lien, désinscription à la déconnexion | C | M | Reçue sur Android et sur iPhone installé |
| Guide d'installation iPhone et Android, bandeau tant que ce n'est pas installé | C | M | Un athlète s'installe seul |
| Repli e-mail si aucune notification n'est possible | C | M | Athlète sans push prévenu par e-mail |
| Regroupement des séances publiées d'un coup, alerte « 2 manquées » | C | M | Une seule notification pour une semaine publiée |
| Manifeste : icône adaptable, captures, raccourcis | C | S | Installation propre sur Android |
| Parcours coach terrain sur profil téléphone (appel, relance, import vidéo), moteur WebKit compris | C | M | Parcours vert sur Chromium et WebKit mobiles |
| Essai sur vrai iPhone et vrai Android d'entrée de gamme : ralenti, envoi, push | T, F, C | M | Compte rendu d'essai, § 5 et § 6 tranchés |
| Signalement de vidéo et traitement des signalements | C | M | Signalement visible et traité |
| Combler la V1 : logo, disciplines, envoi de vidéo coach avec progression | C | M | Écarts du § 5 fermés ou reportés |

### Phase 3 : design, écran par écran

| Tâche | Qui | Effort | Terminé quand |
| --- | --- | --- | --- |
| Registre des écrans : un fichier listant les 5 étapes du § 9.12 pour chacun, web et mobile | C | S | Tous les écrans listés |
| Passer les écrans ajoutés dans les trois skills | C | L | Registre coché |
| Repasser les écrans web existants avec les étapes manquantes, vrais Safari et iPhone | C | L | Registre coché |
| Retirer les capitales de section, remplacer `window.confirm` | C | S | Écarts du § 7 fermés |
| Brancher le détecteur d'Impeccable en CI, si son binaire s'y prête | C | S | Anti-pattern qui fait échouer la CI |
| Test du rouge en plein soleil à la piste | F, T | S | Décision écrite, cahier et `DESIGN.md` alignés |

Le mobile suit la même passe en phase 5.

### Phase 4 : pilote, 6 semaines

| Tâche | Qui | Effort | Terminé quand |
| --- | --- | --- | --- |
| Faire valider le cahier et répondre aux 8 questions du § 19.1 | T, F | S | Réponses écrites |
| Saisir 30 à 50 exercices réels | F, C | M | Bibliothèque remplie |
| Console éditeur minimale : espaces, indicateurs du § 18, signalements, accès réservé par liste d'adresses | C | M | Indicateurs lisibles sans SQL |
| Ajouter ton frère à la liste, inviter le groupe, installer à la piste | T, F | S | Athlètes actifs |
| Question de satisfaction mensuelle | C | S | Réponses enregistrées |
| Point hebdomadaire, corrections | T, F, C | suivi | **Critère de sortie : plus de 70 % de validation après 4 semaines, 100 % des séances via Tartan (§ 18)** |

### Phase 5 : stores, en parallèle dès la phase 2

| Tâche | Qui | Effort | Terminé quand |
| --- | --- | --- | --- |
| Ouvrir Apple Developer et Google Play | T | S | Comptes actifs |
| **Étirement sur mobile** : envoi et lecteur, essai à 240 i/s | C | M | 720 images sur iPhone et Android |
| Projet EAS, clé APNs, Firebase, `TEAMID`, empreintes | T puis C | M | Build interne sur les deux plateformes |
| Connexion Apple et Google, serveur et mobile, toujours les deux ensemble | T puis C | M | Connexion sur vrai appareil |
| Envoi Android au premier plan, révocation Apple, liens `/r`, `/seance`, `/mes-sauts` | C | M | Essais réussis |
| Parité terrain : invitation, fiche athlète, exercices et calendrier éditables | C | L | Parcours § 6 sur mobile |
| Passe design mobile, VoiceOver et TalkBack | C | L | Registre coché |
| Compte de démonstration, fiches, formulaires de confidentialité | C, T | M | Prêts pour la review |
| Message de limite sans incitation à l'achat tant que l'achat intégré n'existe pas | C | S | Rien à reprocher à la règle d'achat |
| **Test fermé Google : 12 testeurs, 14 jours** | T, F | suivi | Accès production demandé |
| TestFlight, puis soumission | T, C | suivi | Apps acceptées |

### Phase 6 : vente, après le pilote

| Tâche | Qui | Effort | Terminé quand |
| --- | --- | --- | --- |
| Décider le compte Stripe, créer la clé limitée, valider l'identité | T, C | S | Clé réelle en production |
| S2 : fixer la version d'API du webhook et lire les bons champs | C | S | Test sur un vrai événement de cette version |
| S3, S6, S7, S8, S10 : quantité, changement d'offre, idempotence, résiliation à la suppression, `unpaid` | C | M | Tests pour chaque scénario |
| S4 : factures avec identité Yodev et mention 293 B | C | S | Facture de test relue |
| S9 : nettoyer le bac à sable Moodday | C | S | Plus aucune trace |
| Paiement réel de bout en bout : carte de test, puis un vrai paiement remboursé | C, T | M | Essai, résiliation, impayé, reprise vérifiés |
| Adhésion au médiateur, mise à jour des CGV | T puis C | S | Plus de `[À DÉFINIR]` |
| Relecture juridique, HDS, mineurs, registre, contrats (§ 15) ; retirer « version de travail » | T | L | Avis écrit |
| Recherche de marque, `tartancoach.com` et `.fr` | T | S | Résultat écrit |
| Interroger 10 à 20 coachs sur le prix (§ 17.1) | T, F | L | Prix confirmés ou corrigés |
| Plafonds vidéo, préavis avant purge | C | S | CGV et code alignés |
| RevenueCat, paywall mobile, parrainage réel et tableau du parrain | T puis C | L | Achat intégré sur vrai appareil |
| **Ton feu vert pour ouvrir les inscriptions** | T | S | `COACH_SIGNUP_MODE=public` |

### Phase 7 : V2 et V3, à trier après le pilote

Ne pas construire avant les retours du pilote.

- **V2 :** parents, dessin et comparaison vidéo, courbes, statistiques de saut, volume dans le constructeur, planification de saison, bilan du matin, module sprint et longueur, préférences de notification, biométrie, déconnexion globale, PDF, variantes d'exercices, tablettes, anglais.
- **V3 :** club, messagerie, lancers, demi-fond et montres, bibliothèque communautaire, commentaire vocal.

## 11. Tes décisions

| # | Décision | Ma recommandation |
| --- | --- | --- |
| 1 | Vente avant ou après le pilote | **Après**, vente coupée d'ici là |
| 2 | Compte Stripe existant ou dédié | **Dédié Tartan** |
| 3 | Inscription des coachs sur le web | **Sur liste** pendant le pilote |
| 4 | Console éditeur minimale | **Oui**, phase 4 |
| 5 | Passer Neon en Launch et ajouter une carte à Mux | **Oui, tout de suite** |

## 12. Ce que toi seul peux faire

- Valider Touch ID sur Stripe quand la vente reprendra, et choisir le compte.
- Passer Neon en Launch, ajouter une carte à Mux.
- Ouvrir Apple Developer et Google Play, créer Firebase.
- Adhérer au médiateur, consulter un juriste, lancer la recherche de marque.
- Avec ton frère : le cahier, les 8 questions, les exercices, les essais sur vrais téléphones, les 12 testeurs Android.
