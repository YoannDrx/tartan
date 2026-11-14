# Recette réelle

Ce qu'un humain doit éprouver lui-même : vrais paiements, vrais e-mails, vrais téléphones. Note chaque écart avec une capture et l'heure, puis ouvre une tâche. Compter une demi-journée, plus 3 h pour le terrain et les téléphones. Coût réel : un abonnement à 19 €, remboursé, moins les frais Stripe.

**Prépare :** une carte bancaire, des comptes de recette Preview, et un compte pilote autorisé pour le paiement réel accompagné, une adresse Outlook et une iCloud, un iPhone et un Android, si possible hors Wi-Fi, une vidéo de moins de 30 s d'un adulte d'accord pour être filmé.

## 1. Administration

- [ ] Ouvrir `https://tartan.coach/admin`, valider avec la passkey. La console s'ouvre.
- [ ] Onglet Configuration : chaque service indique En place, À faire ou À vérifier, sans valeur secrète.
- [ ] Ajouter une passkey de secours sur un second appareil.
- [ ] Espaces : l'offre offerte apparaît aussi dans Abonnements.
- [ ] Rouvrir la console plus de 12 h après : la passkey est redemandée.

## 2. Vidéo

Mux est désormais à la demande. Vérifier le plafond technique effectif et les quotas de l’offre ; le forfait prestataire ne signifie pas vidéo illimitée. Éprouver d’abord les parcours sur la Preview avec ses propres identifiants Mux.

- [ ] Envoyer une vidéo depuis le web : pourcentage, traitement, puis lecture sans recharger, en moins de 2 minutes environ.
- [ ] Ralenti, image par image, annotation : pas d'erreur de lecture.
- [ ] Envoyer depuis un iPhone, puis un Android : la vidéo devient lisible sans tirer pour rafraîchir.
- [ ] Couper le réseau pendant un envoi mobile, le rétablir : l'envoi reprend seul.
- [ ] Journaux Vercel : aucune occurrence de `mux_webhook_rejected`.

## 3. E-mails

- [ ] Configuration → E-mails de test → Tous, vers Gmail, Outlook, iCloud : 29 messages `[Essai]`, en boîte de réception.
- [ ] Sur téléphone et ordinateur, en thème clair et sombre : texte lisible, bouton visible, accents corrects, date limite encadrée dans le rappel annuel.
- [ ] Un bouton de chaque type ouvre Tartan sans erreur.
- [ ] Webhook Resend en place : un envoi à `bounced@resend.dev` supprime l'adresse des envois suivants.

## 4. Compte neuf, sans aide

Sur la Preview isolée uniquement, note chaque hésitation, pas seulement les pannes. Aucun compte créé pour la recette en production.

- [ ] Configuration Preview : inscriptions de recette autorisées ; le site et le formulaire restent cohérents. Les inscriptions de production restent fermées, leur ouverture appartient au fondateur.
- [ ] Depuis `preview.tartan.coach` en navigation privée, les trois offres se lisent sur téléphone sans défilement horizontal.
- [ ] Créer un espace : e-mail de vérification puis de bienvenue, en moins de 2 minutes.
- [ ] Inviter un athlète, accepter depuis un téléphone : e-mail reçu, accords santé et vidéo demandés.
- [ ] Créer une séance et la publier : l'athlète la voit et peut la valider.
- [ ] Lien de connexion et réinitialisation du mot de passe : deux e-mails distincts, liens valables une fois.

## 5. Paiement réel

Après recette navigateur sandbox verte, avec le fondateur et un compte pilote explicitement autorisé. Ne pas créer de client de production pour les tests automatisés. Les réglages fiscaux et mentions de facture doivent être confirmés par le comptable ; ne pas présumer le régime applicable.

Le premier abonnement commence par 14 jours d'essai : aucun débit au départ.

- [ ] Abonnement → Coach au mois : page Stripe avec 19 €, 14 jours d'essai, nom Tartan, mention des CGV.
- [ ] Payer avec une vraie carte : retour sur Tartan, essai actif, e-mail de confirmation.
- [ ] Tableau de bord Stripe, mettre fin à l'essai : 19 € débités, facture créée.
- [ ] Console → Factures : la facture apparaît en 2 minutes. PDF : identité du vendeur, TVA 0, mention 293 B.
- [ ] Revenus : MRR à 19 €, un seul abonné payant hors offres offertes.
- [ ] Résilier depuis Abonnement : e-mail, date de fin affichée, offre maintenue jusqu'à cette date.
- [ ] Rembourser depuis la facture, motif rétractation : double confirmation, passkey récente, avoir émis, alerte e-mail.
- [ ] Stripe : aucune livraison de webhook en échec.
- [ ] Confirmer que les inscriptions de production restent fermées après cette transaction pilote.

## 6. Notifications et téléphones

- [ ] iPhone : installer la PWA depuis Safari, activer les notifications. Android avec Chrome : idem.
- [ ] Publier une séance : notification en moins de 15 minutes, lien vers la bonne séance.
- [ ] Désactiver la catégorie Séances, republier : plus de notification.
- [ ] Notifications coupées sur l'appareil : e-mail de repli reçu.
- [ ] Sur build TestFlight et Android interne : push natif reçu, lien profond correct.
- [ ] App native : parcourir les écrans coach dans le thème Tartan, rien de coupé.
- [ ] VoiceOver et TalkBack sur trois écrans clés : chaque bouton a un nom compréhensible.
- [ ] Android entrée de gamme : envoi vidéo écran éteint.
- [ ] Déclarer une version de test dans Versions : bandeau, puis Nouveautés.

## 7. Terrain, au stade

- [ ] Séance ouverte en Wi-Fi, puis mode avion : lisible, avec un bandeau hors ligne.
- [ ] Appel et séries en mode avion : saisies gardées, marquées en attente.
- [ ] Filmer en mode avion : la vidéo rejoint la file.
- [ ] Rétablir le réseau : tout part sans action, sans doublon.
- [ ] Publication d'une version pendant une séance : aucun rechargement forcé.
- [ ] Écran au soleil, doigts humides ou gants fins : lisible, boutons atteignables d'un geste.

## 8. Planificateur IA et dictées

Uniquement des demandes fictives, sans nom ni donnée de santé.

- [ ] L'accord mentionne OpenAI et les États-Unis, avant toute saisie.
- [ ] Séance simple avec charge chiffrée : brouillon conforme, ni date ni charge inventée.
- [ ] Semaine entière sans jours précisés : une question, pas une proposition au hasard.
- [ ] Trente dictées humaines enregistrées sur iOS et Android, dont des situations bruitées : nombres, unités, mouvements, récupérations et ambiguïtés relus ; texte éditable avant envoi. Les phrases synthétiques ne comptent pas comme dictées humaines.
- [ ] Brouillons relus : aucune séance publiée sans action de ta part.
- [ ] Retirer l'accord : le planificateur le redemande.
- [ ] Espace Découverte sur l'app native : aucune entrée IA, aucune mention d'offre payante.

## Non couvert jusqu'ici par les essais sur simulateur

Génération IA réelle dans l'app, dictée, VoiceOver, hors ligne réel, Android, téléphones physiques.
