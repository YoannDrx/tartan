# Tartan — produit

**register: product**

Application de suivi d'entraînement pour les coachs d'athlétisme des disciplines techniques et explosives (sauts, sprint, haies) et leurs athlètes. Pilote : un groupe de saut en hauteur aux niveaux variés, dont une partie s'entraîne seule à partir de séances envoyées aujourd'hui par SMS.

**Vision.** Le carnet d'entraînement partagé du coach d'athlé et de son groupe : chacun sait ce qu'il a à faire, le coach sait ce qui a été fait, et chaque saut devient une occasion de progresser.

**Ce que la V1 doit réussir.** Remplacer les SMS. Savoir qui a fait quoi : l'athlète valide en moins de 10 secondes, le coach voit une grille athlètes × séances. Analyser les sauts : filmer, revoir au ralenti, commenter sur la timeline, partager.

**Le principal risque.** Les athlètes ne rempliront rien si valider demande plus de quelques secondes. Chaque décision côté athlète se juge à l'aune de ce critère.

## Utilisateurs

- Coach principal : terrain et ordinateur. Créer vite, attribuer finement, voir qui a fait quoi, analyser les sauts.
- Coach adjoint / préparateur physique : gère ses séances, voit les retours.
- Athlète adulte : vient au club ou s'entraîne seul. Savoir quoi faire, valider sans effort.
- Athlète mineur : même chose, dans un cadre protégé ; accord d'un parent sous 15 ans pour la santé et les vidéos.

## Plateformes

- Web (Next.js, `apps/web`) : desktop coach pour planifier, version mobile pour ouvrir une invitation sans installation, site tartan.coach.
- iOS et Android (Expo, `apps/mobile`) : athlètes et coachs sur le terrain, caméra, notifications, hors ligne.

## Ton

Côté athlète : tutoiement, phrases courtes, encourageant sans infantiliser (« Séance validée, bien joué »). Côté coach : sobre et précis, vocabulaire du métier (RPE, 1RM, contacts au sol, appel, impulsion). Les messages importants sont signés du coach.

## Principes

10 secondes côté athlète. Le contexte avant la discussion (échanges sous une séance ou une vidéo, pas de chat). Mobile d'abord, desktop pour construire. Le coach reste la voix. Lisible sur le terrain. Pensé pour plusieurs. Respect des données.
