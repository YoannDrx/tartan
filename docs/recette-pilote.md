# Recette et pilote : ce qui se fait sur le terrain

Ce qui ne peut pas être vérifié depuis le code. À cocher au fil de l'eau.

## 1. Recette en production, avec ton téléphone (20 minutes)

- [ ] Sur `app.tartan.coach`, connexion par lien magique avec ton adresse. L'e-mail arrive, le lien ouvre l'espace.
- [ ] Crée un groupe, puis copie son lien d'invitation.
- [ ] Sur ton téléphone, en navigation privée ou avec une autre adresse : ouvre le lien, rejoins le groupe, donne les accords.
- [ ] Depuis l'ordinateur : publie une séance pour aujourd'hui.
- [ ] Sur le téléphone : la séance arrive, valide-la en moins de 10 secondes.
- [ ] Sur l'ordinateur : la grille passe à « Fait ».
- [ ] Ouvre `/admin` depuis l'ordinateur : ton espace y apparaît.

## 2. Essai sur vrais téléphones (une séance)

Un iPhone et un Android d'entrée de gamme.

- [ ] **Installation** : le bandeau guide correctement, l'icône arrive sur l'écran d'accueil.
- [ ] **Notifications** : activées après l'installation, séance reçue sur les deux. Sur Android, « Oui / Non » répond sans ouvrir l'app.
- [ ] **Sans installation sur iPhone** : l'e-mail de repli arrive.
- [ ] **Hors ligne** : mode avion, journée et séance s'ouvrent, valider, couper puis remettre le réseau : le coach le voit.
- [ ] **Vidéo** : filme en ralenti avec l'appareil photo, importe depuis le navigateur. Vérifie la cadence affichée (240 i/s attendus) et le pas image par image dans le lecteur.
- [ ] **Coupure pendant l'envoi** : mode avion au milieu, réseau remis, l'envoi reprend.
- [ ] **Safari en arrière-plan** : change d'app pendant l'envoi, reviens, l'envoi reprend.
- [ ] **Plein soleil** : le rouge et les grilles se lisent-ils à la piste ?

À noter pour moi : modèle du téléphone, version du système, ce qui a coincé.

## 3. Avant d'inviter le groupe

- [ ] Sauvegarde quotidienne en route : `docs/sauvegarde.md`, une commande à lancer, puis clé privée rangée dans ton gestionnaire de mots de passe.
- [ ] Adresse de ton frère ajoutée à `COACH_SIGNUP_EMAILS` (me la donner suffit).

Mux et Neon restent sur leur offre gratuite. Quand passer à l'offre payante :

- **Mux :** dès que la limite de 10 vidéos stockées gêne le pilote. Tartan affiche « x vidéos stockées sur 10 » et refuse proprement l'envoi suivant. Ajouter la carte, puis me demander de retirer `MUX_VIDEO_LIMIT`.
- **Neon :** si la base dépasse 800 Mo ou 80 CU-heures par mois, et de toute façon avant la vente.

## 4. Avec ton frère, avant de démarrer

Les 8 questions du § 19.1 du cahier :

1. Combien d'athlètes dans le groupe, combien de mineurs, combien sur Android ?
2. Combien de séances par semaine, dont combien en autonomie en moyenne ?
3. Quels exercices reviennent le plus souvent ?
4. Comment note-t-il aujourd'hui les charges et les tests de force ?
5. Filme-t-il toujours avec le même téléphone ? En ralenti ? Depuis quel angle ?
6. Y a-t-il d'autres coachs qui interviennent sur ses athlètes ?
7. Que voudrait-il voir en premier le lundi matin ?
8. Accepte-t-il une version imparfaite pendant 6 semaines, avec des retours chaque semaine ?

Puis : remplir 30 à 50 exercices réels (31 exercices de départ sont déjà fournis, à corriger ou compléter).

## 5. Le pilote, 6 semaines

Point chaque semaine, indicateurs dans `/admin`.

| Indicateur (§ 18)                    | Cible                            |
| ------------------------------------ | -------------------------------- |
| Taux de validation                   | Plus de 70 % après 4 semaines    |
| Délai médian de validation           | Moins de 12 h                    |
| Athlètes actifs                      | Plus de 80 %                     |
| Activation sous 7 jours              | Plus de 75 %                     |
| Vidéos partagées par semaine de saut | Au moins 1 par athlète présent   |
| Usage coach, à relever avec lui      | 100 % des séances via Tartan     |
| Recommanderais-tu Tartan ?           | Retours majoritairement positifs |

**Critère de sortie :** plus de 70 % de validation après 4 semaines et fin des SMS. Sinon, on corrige avant toute vente.

## 6. Avant la vente

Voir le § 12 du plan et `docs/conformite.md`. Ensuite, seulement :

- [ ] Compte Stripe choisi, clé limitée créée avec Touch ID, droits : Customers, Checkout Sessions et Customer Portal en écriture, Subscriptions en écriture, Payment Methods en lecture.
- [ ] Webhook réactivé, ou recréé sur le compte dédié.
- [ ] Un vrai paiement remboursé, puis résiliation.
- [ ] 10 à 20 coachs interrogés sur le prix.
- [ ] Ton feu vert pour ouvrir les inscriptions.
