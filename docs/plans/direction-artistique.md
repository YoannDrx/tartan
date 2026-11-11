# Plan : direction artistique « Le stade » et jeu

Décidé par le fondateur le 11 novembre 2026. Ce plan vient après la mise en vente de la web app ([web.md](web.md)). Les règles visuelles sont dans [../../DESIGN.md](../../DESIGN.md) : ce document dit seulement dans quel ordre les appliquer. L'avancement est dans [../ETAT.md](../ETAT.md).

## Ce que la refonte corrige

Constats du 11 novembre, dans le code et sur le site à 375 px.

| Constat | Où |
| --- | --- |
| Le film occupe 5 500 px sur téléphone avant la première capture | `.film` à 680svh, `apps/web/app/globals.css` |
| Tableau tarifaire à trois colonnes sur téléphone, mots coupés | `PricingGrid` |
| Captures et texte côte à côte à 375 px | Sections `LapBend` de `apps/web/app/page.tsx` |
| L'accueil athlète et l'écran de séance n'ont pas le bandeau piste | `apps/web/src/lib/world.ts` |
| « Publier » n'est collant que sur ordinateur | `src/features/sessions/session-builder.tsx` |
| En-tête coach surchargé sur téléphone | `src/features/shell/app-shell.tsx` |
| Tableaux de 640 et 840 px dans la console | `src/features/admin/console-ui.tsx`, `app/(app)/admin/page.tsx` |
| Textes de 10 et 11 px | `month-grid.tsx`, barre basse |
| Textes en dur, palette brute, hexadécimaux non contrôlés | Environ 76 fichiers ; `video-analysis.tsx`, `session-mode.tsx` ; `globals.css` |
| Trois squelettes de mascotte | `jump-film.tsx`, `src/components/jumper.tsx`, `apps/mobile/src/ui/jumper-rig.ts` |

## Lots de direction artistique

| Lot | Branche | Contenu | Fini quand |
| --- | --- | --- | --- |
| B1 | `feat/jetons-mouvement` | `packages/design-tokens/src/motion.ts` et son miroir CSS ; filet global de mouvement réduit ; aide `expectNoMotion` dans `e2e/helpers.ts` ; miroir des couleurs étendu à tout `globals.css` ; CSS mort retiré | Tests de miroir et e2e |
| B2 | `feat/rig-mascotte` | Paquet `packages/mascot` : squelette décrit en données, rendus SVG, canvas et react-native-svg ; le film, la mascotte web et le mobile l'utilisent ; curseur de la frise du film vérifié | Le nouveau geste de hauteur reproduit 200 poses figées de l'ancien |
| B3 | `feat/gestes-epreuves` | Six épreuves, accessoires, six personnages ; planche `/admin/mascotte` ; composants de piste (ligne, virage, tour de piste, numéro, départ, arrivée) | Revue de la planche par le fondateur |
| B4 | `feat/view-transitions` | Enveloppe `src/components/ui/view-transition.tsx`, transitions du site et de l'application | E2E, mouvement réduit |
| B5 | `feat/landing-stade` | Page d'accueil refondue, `/tarifs`, `/contact`, pages légales, 404, hors ligne | 390, 768, 1440 px ; axe ; chargement non dégradé |
| B6 | `feat/da-ossature` | En-tête coach allégé sur téléphone, barre basse, chargements, états vides et erreurs avec les athlètes, feuilles, dialogues, messages | 390, 768, 1440 px ; axe |
| B7 | `feat/da-athlete` | Accueil et écran de séance ramenés dans le système commun, mode séance, progrès, calendrier, vidéos | Idem |
| B8 | `feat/da-coach` | Suivi, calendrier, constructeur, exercices, athlètes, vidéos, planificateur, analyse, phases, abonnement, réglages | Idem |
| B9 | `feat/da-finitions` | Connexion, onboarding, console d'administration, écrans immersifs passés aux jetons, illustrations des e-mails | Idem |

B1 et B2 ne touchent à aucun fichier de la mise en vente et peuvent avancer en même temps qu'elle. `globals.css` et `packages/design-tokens/src/index.ts` se modifient en série : B1, puis B3. L'application native suit dans le chantier des stores.

### La page d'accueil, téléphone d'abord

1. Départ : titre, promesse et bouton visibles tout de suite ; film d'environ 300svh sur téléphone et 450svh sur ordinateur, en relais entre trois athlètes.
2. Le long de la piste : coach, constructeur, contenus, mois et progrès, vidéo, terrain. Sur téléphone, capture puis texte, en une colonne.
3. Le groupe : bande à défilement horizontal des six athlètes.
4. Tarifs : une carte par offre sur téléphone, tableau complet replié ; tableau sur ordinateur.
5. Ligne d'arrivée, puis l'aperçu du jeu, les questions fréquentes et l'appel final.

Contraintes existantes à respecter : `tests/landing-provenance.test.ts` (captures réelles déclarées, mots interdits dans `page.tsx`), `e2e/pilot.spec.ts` (un seul titre principal). L'effet de l'aperçu du jeu sur les inscriptions se mesure avec les événements d'audience existants.

## Le jeu : « Tartan Meeting »

Jeu original, au pouce : appuyer, tenir, relâcher. Barre d'espace au clavier. Chaque épreuve dure 15 à 30 secondes.

| Épreuve | Geste | Ce qui fait la performance | Faute |
| --- | --- | --- | --- |
| 110 m haies | Appuyer pour franchir chaque haie | Justesse de chaque appui | Haie renversée : ralentissement |
| Longueur | Appuis en cadence, tenir pour l'angle, relâcher sur la planche | Vitesse d'élan, angle, distance à la planche | Mordu |
| Triple saut | Élan en cadence, puis trois appuis à chaque réception | Conservation du rythme | Mordu, rythme cassé |
| Hauteur | Appuyer pour l'appel, tenir pour le cambré, relâcher pour dégager les jambes | Barre qui monte, trois essais par hauteur | Barre tombée |
| Perche | Appuyer pour planter, tenir pendant la flexion, relâcher au renversement | Barre qui monte, trois essais par hauteur | Barre tombée |
| Disque | Tenir pour accélérer la volte, relâcher dans le secteur | Vitesse de rotation, angle de lâcher | Hors secteur |

Modes : épreuve libre, combiné des six épreuves avec un barème propre, défi du jour à conditions égales pour tous.

### Scores vérifiés par le serveur

- La simulation (`packages/game`) est déterministe : pas fixe de 120 Hz, arithmétique entière, hasard à graine. Aucune fonction dont le résultat varie d'un navigateur à l'autre (`Math.sin`, `pow`), ce qu'un test de garde vérifie.
- Le navigateur envoie le journal des appuis. Le serveur rejoue la partie et calcule lui-même le score. Un score déclaré par le client n'est jamais cru.
- Limite : le rejeu prouve qu'un score découle d'appuis valides, pas qu'un humain a joué, et le code est public. D'où un jeton de partie à usage unique et à durée courte, un contrôle de durée réelle, un plafond théorique par épreuve, une limitation de débit, un classement hebdomadaire remis à zéro et le retrait depuis la console.

### Données et modération

Pseudo de 3 à 16 caractères, score, date, empreinte d'un identifiant d'appareil, empreinte d'adresse IP purgée à 30 jours. Ni compte, ni e-mail. Effacement possible sans compte. Mots refusés, masquage et bannissement dans `/admin/jeu`, coupe-circuit dans `/admin/configuration`. Le jeu est sur un site public, donc accessible à des mineurs : question posée au juriste dans [conformite.md](../reference/conformite.md).

### Lots du jeu

| Lot | Branche | Contenu | Fini quand |
| --- | --- | --- | --- |
| J1 | `feat/jeu-simulation` | Paquet `packages/game`, noyau et épreuve des haies, parties de référence | Même score sous Node, Chromium et WebKit |
| J2 | `feat/jeu-page` | `/jeu` : `SITE_PATHS` de `apps/web/proxy.ts`, `app/sitemap.ts`, `app/robots.ts`, image de partage statique ; canvas, contrôles, record local | E2E, axe, politique de sécurité de contenu inchangée |
| J3 | `feat/jeu-classement` | Modèles additifs, `src/server/game.service.ts`, routes `/api/v1/game/*`, rejeu serveur, `/admin/jeu`, mention de confidentialité | Jeton rejoué, journal falsifié, pseudo refusé et débit dépassé sont refusés |
| J4 | `feat/jeu-encart` | Aperçu sur la page d'accueil : affiche statique, chargement au premier geste | Aucun fichier du jeu chargé avant le défilement |
| J5 à J9 | `feat/jeu-<épreuve>` | Longueur, triple saut, hauteur, perche, disque | Parties de référence |
| J10 | `feat/jeu-combine` | Combiné et barème | Classement du combiné |

J1 ne dépend de rien. J2 attend B3 pour les athlètes, J3 attend la matrice d'accès (A1).

Accessibilité : clavier, boutons tactiles de 64 px, résultats et classement en HTML, annonce du résultat aux lecteurs d'écran, mouvement réduit respecté. Pas de son en première version. Le jeu se rend en canvas 2D, chargé à la demande, sans bibliothèque de jeu.
