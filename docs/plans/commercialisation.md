# Plan : commercialiser Tartan

La vente ouvre sur le web et la PWA. iOS et Android suivent sans la retarder. L'avancement est dans [../ETAT.md](../ETAT.md).

## Offres

Source unique : `packages/domain/src/plans.ts`. Pas de chiffre recopié ailleurs dans le code.

| Offre | Prix mois / an | Athlètes | Groupes | Coachs | Vidéos par mois | Conservation | IA par mois |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Découverte | Gratuit | 5 | 1 | 1 | 10 | 30 jours | Non |
| Coach | 19 € / 190 € | 30 | Illimités | 2 | 100 | 1 an | 30 propositions, 60 min de dictée |
| Club | 59 € / 590 € | Illimités | Illimités | Illimités | 500 | 3 ans | 150 propositions, 300 min de dictée |

Essai de 14 jours au premier abonnement d'un espace. Les athlètes ne paient jamais. TVA non applicable (art. 293 B), seuil de franchise à faire confirmer par un comptable : le CA de l'année est visible dans la console.

## Portes de l'ouverture

Les inscriptions restent fermées tant qu'une porte n'est pas franchie. L'ouverture est une décision du fondateur.

| # | Condition | Qui |
| --- | --- | --- |
| 1 | Avis écrit du juriste : HDS, vidéos, OpenAI, conservation | Fondateur |
| 2 | Médiateur désigné, CGV validées, « version de travail » retirée | Fondateur, puis agent |
| 3 | Clé OpenAI remplacée, accord de traitement signé | Fondateur |
| 4 | Vrai paiement, facture, résiliation, remboursement depuis la console | Fondateur |
| 5 | Configuration verte : webhooks, sondes, passkey de secours | Fondateur, agent |
| 6 | Plafond Mux levé, Neon payant, sauvegardes hors de GitHub | Fondateur, agent |
| 7 | E-mails reçus sur Gmail, Outlook, Apple Mail | Fondateur |
| 8 | Recette iPhone et Android (PWA, push web), hors ligne au stade | Fondateur |
| 9 | Compte neuf : de l'inscription au paiement, sans aide | Fondateur |
| 10 | Tests critiques T01 à T08 verts | Agent |

**« Commercialisable » veut dire :** aucun défaut bloquant ouvert, fonctions annoncées disponibles, livraison des notifications observable, paiement et résiliation éprouvés, récupération des données testée, confidentialité et support opérationnels, validation par de vrais utilisateurs.

## Pilote, avant ou pendant l'ouverture

Six semaines avec un petit groupe réel, point chaque semaine, indicateurs dans `/admin`.

| Indicateur | Cible |
| --- | --- |
| Taux de validation des séances | Plus de 70 % après 4 semaines |
| Délai médian de validation | Moins de 12 h |
| Athlètes actifs | Plus de 80 % |
| Activation sous 7 jours | Plus de 75 % |
| Usage par le coach | Toutes les séances passent par Tartan |

Critère de sortie : plus de 70 % de validation après 4 semaines, et fin des SMS. Sinon, corriger avant de vendre.

Questions à poser au coach : taille du groupe et part d'Android ; séances par semaine, dont en autonomie ; exercices les plus fréquents ; manière de noter charges et tests ; matériel et angle de film ; autres coachs impliqués ; ce qu'il veut voir le lundi matin ; acceptation d'une version imparfaite pendant 6 semaines.

## Le jour de l'ouverture

1. Fin du plan [web](web.md), étape 4.
2. Prévenir les deux espaces pilotes des fonctions activées.
3. Ouvrir les inscriptions dans Configuration, vérifier la landing et un compte neuf.
4. Surveiller 72 heures (plan web, étape 6).

## Après l'ouverture : priorités produit

1. Premier résultat en quelques minutes : séance modèle, publication et invitation dans le même parcours.
2. Constructeur plus progressif : titre, date, groupe et contenu d'abord, le reste ensuite.
3. État fiable après chaque action : enregistré sur l'appareil, en attente, reçu, erreur.
4. Page Aujourd'hui plus contextuelle : revoir une séance validée, repos clair les jours vides.
5. Coaching au téléphone : l'appel aussi évident que sur ordinateur.
6. Aide contextuelle courte et contact visible dans l'app.

## Support

Boîte `hello@tartan.coach`. Signalements examinés sous 48 h ouvrées (promesse des conditions). Procédure de rapprochement facturation : [stripe.md](stripe.md).
