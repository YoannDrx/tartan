# Tes actions pour ouvrir Tartan

Le mode d'emploi des cases de `docs/plan-ouverture-publique.md` qui ne dépendent que de toi, dans l'ordre. Rien ici n'a encore été envoyé ni payé.

## À savoir après le plan V1 (4 novembre)

- **Ta date de naissance :** ton compte la demandera à la prochaine connexion. **Une seule saisie est possible** : une faute sur l'année qui te ferait passer pour mineur ferme tous tes espaces, et seule une correction en base les rouvre.
- **Signal de vie :** crée la sonde externe, puis pose `CRON_HEARTBEAT_URL` et `CRON_HEARTBEAT_NOTIFICATIONS_URL` dans Vercel (deux adresses, car les seuils diffèrent). Sans elles, une tâche planifiée arrêtée ne déclenche aucune alerte.
- **Préversion :** `preview.tartan.coach` n'existe pas encore, alors que le profil `preview` de l'app mobile le vise.
- **Script d'isolation :** `scripts/verify-env-isolation.mjs` ne peut pas lire les variables « sensibles » de Vercel, et il le dit. Contrôle celles-là à la main.
- **Mobile :** le DSN Sentry mobile et `SENTRY_AUTH_TOKEN` restent à poser. Le téléversement des symboles a échoué en local et reste coupé : à réessayer avec le premier build EAS.
- **Pour le juriste :** après 24 mois d'inactivité, l'espace sans autre coach est supprimé avec les données de ses athlètes, et seul le propriétaire est prévenu. Fais valider cette règle.

## Aujourd'hui (20 minutes)

1. **Relire la landing** sur [tartan.coach](https://tartan.coach), sur ordinateur et sur téléphone. Dis-moi ce qui ne te plaît pas.
2. **Ranger la clé de sauvegarde** : copie `~/.tartan/cle-sauvegarde.txt` dans ton gestionnaire de mots de passe. Sans elle, les sauvegardes sont illisibles.
3. **Sécuriser le jeton Blob** : dans Vercel, projet `tartan`, Settings, Environment Variables, recrée `BLOB_READ_WRITE_TOKEN` en « Sensitive », avec un jeton distinct pour la production.
4. **Contrôler trois valeurs** dans Vercel :
   - `EMAIL_FROM` doit finir par `@mail.tartan.coach` une fois le domaine vérifié dans Resend, sinon `@yodev.fr` ;
   - `DATABASE_URL` en Preview doit être différente de la production ;
   - `STRIPE_SECRET_KEY` en Preview doit commencer par `sk_test_` ou `rk_test_`.
5. **Tester le contact** : envoie un message à `hello@tartan.coach` depuis une autre adresse et vérifie qu'il arrive sur Gmail.
6. **Me donner l'adresse de ton frère**, pour `COACH_SIGNUP_EMAILS`.

## Cette semaine

### Le juriste

Cherche un avocat en droit du numérique et des données personnelles. Message à adapter :

> Bonjour,
>
> J'édite Tartan (Yodev, entreprise individuelle), une application de suivi d'entraînement pour les coachs d'athlétisme, déjà en ligne, avec inscriptions encore fermées. Je veux l'ouvrir au public et à la vente.
>
> Elle traite des données d'athlètes, souvent mineurs : blessures, douleurs, effort ressenti, et vidéos hébergées par un prestataire aux États-Unis. Elle intègre aussi des vidéos publiques d'autres auteurs, venues de YouTube et d'Instagram.
>
> Je cherche un avis écrit sur ces points, avant l'ouverture : certification HDS, hébergement des vidéos de mineurs, rôle de responsable de traitement, retrait de l'accord vidéo, départ d'un athlète, cache hors ligne du coach, CGV, médiation et vidéos de tiers.
>
> J'ai préparé un dossier avec le registre des traitements, les sous-traitants et 9 questions précises. Pouvez-vous me dire vos délais et votre tarif pour cette mission ?

Joins `docs/conformite.md` et les pages `/confidentialite`, `/conditions` et `/cgv`.

**Donne-moi ensuite :** l'avis écrit. Je fais les changements demandés dans le code et les textes, puis je retire la mention « version de travail ».

### Le médiateur

Vérifie que CM2C figure sur la liste officielle des médiateurs, puis adhère : [inscription CM2C](https://www.cm2c.net/inscription-professionnel.php).

**Donne-moi ensuite :** le nom et l'adresse à publier. Je complète `/cgv`.

### Les essais réels, avec ton frère (une séance)

Suis `docs/recette-pilote.md`, § 1 et 2, sur un iPhone et un Android d'entrée de gamme, de préférence à la piste, avec un vrai saut filmé au ralenti.

**Donne-moi ensuite :** le modèle du téléphone, la version du système, ce qui a coincé, et une capture si possible.

## Avant l'ouverture

### Le vrai paiement

Je ne peux pas le passer à ta place, mais je vérifie chaque étape de mon côté. Préviens-moi au début.

1. Dans un espace de test à toi, sur la production, choisis l'offre Coach au mois.
2. Vérifie sur la page Stripe : 19 €, 14 jours d'essai, nom Tartan.
3. Après le retour : `/abonnement` affiche l'offre Coach.
4. Dans le portail Stripe, résilie : `/abonnement` affiche la date de fin.
5. Un essai ne débite rien. Pour tester la facture, reprends un abonnement et termine l'essai depuis le tableau de bord Stripe, puis rembourse le paiement.
6. Vérifie la facture : identité Yodev et mention « TVA non applicable, art. 293 B ».

### Mux et Neon

- **Mux** : ajoute une carte. Préviens-moi, je retire `MUX_VIDEO_LIMIT`.
- **Neon** : passe en Launch. Préviens-moi, je teste la restauration.

### Le reste

- Contrats de sous-traitance (DPA) : la liste est dans `docs/conformite.md`. Le juriste te dira lesquels signer en priorité.
- Marque : recherche sur [data.inpi.fr](https://data.inpi.fr), et réservation de `tartancoach.com` et `.fr`.
- Prix : interroge 10 à 20 coachs, puis dis-moi si 19 € et 59 € tiennent.

## Le jour de l'ouverture

1. Tu crées un compte neuf en production, et je suis la répétition avec toi.
2. Tu me donnes ton feu vert.
3. Je passe `COACH_SIGNUP_MODE=public`, puis je surveille Sentry, Stripe, les e-mails et la capacité pendant 72 h.
