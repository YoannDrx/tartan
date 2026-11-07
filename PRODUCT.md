# Tartan — produit

**register: product**

Tartan est l'outil de préparation physique pour les coachs et athlètes d'athlétisme : planifier, individualiser, suivre et comprendre la progression. Force, vitesse, puissance, endurance et mobilité sont des usages de premier plan. Le saut en hauteur reste une spécialité disponible ; ses champs et son vocabulaire ne s'imposent pas aux autres disciplines.

**Vision.** Le carnet d'entraînement partagé du coach et de son groupe : chacun sait ce qu'il a à faire, le coach sait ce qui a réellement été fait, et l'historique aide à comprendre la progression.

**Ce que la V1 doit réussir.** Remplacer les SMS. Savoir qui a fait quoi : l'athlète valide en moins de 10 secondes, le coach voit une grille athlètes × séances. Analyser les sauts : filmer, revoir au ralenti, commenter sur la timeline, partager.

**Le principal risque.** Les athlètes ne rempliront rien si valider demande plus de quelques secondes. Chaque décision côté athlète se juge à l'aune de ce critère.

**Décision V1.1 du 7 novembre 2026.** Le fondateur autorise explicitement l'extension à la saisie des séries réalisées, aux références de force liées aux exercices, aux records, aux phases partagées et aux statistiques avec provenance. La saisie détaillée reste facultative : une validation simple reste possible, sans transformer une prescription en réalisation supposée. Le planificateur IA prépare des brouillons à relire, sans publication autonome ; sa bêta ne conditionne pas l'ouverture commerciale des autres fonctions. Livraison en deux PR selon `docs/livraison-v1-1.md`. Les états de ce document de livraison font foi sur ce qui est effectivement disponible.

## Utilisateurs

- Coach principal : terrain et ordinateur. Créer vite, attribuer finement, voir qui a fait quoi, analyser les sauts.
- Coach adjoint / préparateur physique : gère ses séances, voit les retours.
- Athlète adulte : vient au club ou s'entraîne seul. Savoir quoi faire, valider sans effort.
- V1 réservée aux majeurs, en France, sportifs compris (décision du 4 novembre 2026). Le parcours d'accord parental reste dans le code, dormant (`PARENTAL_FLOW_ENABLED`).

## Plateformes

- Web (Next.js, `apps/web`) : desktop coach pour planifier, version mobile pour ouvrir une invitation sans installation, site tartan.coach.
- iOS et Android (Expo, `apps/mobile`) : athlètes et coachs sur le terrain, caméra, notifications, hors ligne.

## Ton

Côté athlète : tutoiement, phrases courtes, encourageant sans infantiliser (« Séance validée, bien joué »). Côté coach : sobre et précis, vocabulaire du métier (RPE, 1RM, contacts au sol, appel, impulsion). Les messages importants sont signés du coach.

## Principes

10 secondes côté athlète. Le contexte avant la discussion (échanges sous une séance ou une vidéo, pas de chat). Mobile d'abord, desktop pour construire. Le coach reste la voix. Lisible sur le terrain. Pensé pour plusieurs. Respect des données.
