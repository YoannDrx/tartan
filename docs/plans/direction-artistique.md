# Plan : direction artistique « Le stade »

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
| B7 | `feat/da-athlete` | Accueil et écran de séance ramenés dans le système commun, carte de séance qui s'ouvre en écran de séance, mode séance, progrès, calendrier, vidéos | Idem |
| B8 | `feat/da-coach` | Suivi, calendrier, constructeur, exercices, athlètes, vidéos, planificateur, analyse, phases, abonnement, réglages | Idem |
| B9 | `feat/da-finitions` | Connexion, onboarding, console d'administration, écrans immersifs passés aux jetons, illustrations des e-mails | Idem |

B1 et B2 ne touchent à aucun fichier de la mise en vente et peuvent avancer en même temps qu'elle. `globals.css` et `packages/design-tokens/src/index.ts` se modifient en série : B1, puis B3. L'application native suit dans le chantier des stores.

### La page d'accueil, téléphone d'abord

1. Départ : titre, promesse et bouton visibles tout de suite ; film de 750svh sur téléphone et 1000svh sur ordinateur, en relais entre trois athlètes. Ramené d'abord à 300 et 450svh, il défilait trop vite : le fondateur l'a fait ralentir le 12 novembre 2026.
2. Le long de la piste : coach, constructeur, contenus, mois et progrès, vidéo, terrain. Sur téléphone, capture puis texte, en une colonne.
3. Le groupe : bande à défilement horizontal des six athlètes.
4. Tarifs : une carte par offre sur téléphone, tableau complet replié ; tableau sur ordinateur.
5. Ligne d'arrivée, puis les questions fréquentes et l'appel final.

Contraintes existantes à respecter : `tests/landing-provenance.test.ts` (captures réelles déclarées, mots interdits dans `page.tsx`), `e2e/pilot.spec.ts` (un seul titre principal).

## Le jeu : retiré le 23 novembre 2026

Le jeu « Tartan Meeting » (lots J1 à J10 : simulation, page, classement, aperçu sur l'accueil, épreuves, combiné) a été livré, puis retiré à la demande du fondateur le 23 novembre 2026. Son code, sa page, son classement et sa modération ont quitté le dépôt ; son ancienne adresse redirige vers l'accueil. Les tables du classement restent dans la base, sans code qui les lise, parce que les migrations sont additives. Le plan d'origine se relit dans l'historique git de ce fichier.
