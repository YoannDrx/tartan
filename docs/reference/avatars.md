# Photo de profil, avatars et logo

Décision du fondateur du 17 novembre 2026 (`PRODUCT.md`), constat G14 de l'audit : la photo s'envoyait dans les réglages mais ne s'affichait nulle part.

## Ce que voit la personne

Dans `/reglages/profil`, trois chemins :

- **Envoyer une photo.** Le fichier est ouvert dans le navigateur, tourné selon sa prise de vue (EXIF), puis recadré : déplacer au pointeur, au doigt ou aux flèches du clavier (Maj : grands pas), toucher un point pour l'amener au centre, zoomer au curseur, au pincement ou avec plus et moins, pivoter par quarts de tour. Un aperçu rond montre le résultat à la taille réelle. Seul le carré recadré part au serveur : 512 × 512 en WebP, en JPEG si le navigateur n'écrit pas le WebP.
- **Choisir un avatar** dans une galerie de deux familles : « Le groupe » (les six athlètes de Tartan, en cadrage tête) et « Animaux ».
- **Revenir aux initiales.**

Le logo de l'espace (`/reglages/espace`) passe par le même recadrage, dans un carré où il peut rester plus petit que le cadre.

## Où l'avatar apparaît

Un seul composant, `apps/web/src/components/avatar.tsx` : la photo, sinon l'avatar choisi, sinon les initiales (`initialsOf`, `packages/domain`). Il est dans l'en-tête (le bouton des réglages), le suivi (sur ordinateur), la liste des athlètes, les membres de l'espace, les commentaires, les annonces, les remarques des vidéos et l'invitation (`/i/[token]`, le coach qui invite).

## Données et contrôles

- `Profile.avatarUrl` (photo dans Vercel Blob) et `Profile.avatarPreset` (`athlete:…` ou `animal:…`, migration `20261118100000_profile_avatar_preset`). L'un efface l'autre.
- Le serveur revérifie chaque envoi (`src/lib/image-check.ts`) : type déclaré, type réel lu dans l'en-tête, 4 Mo au plus, carré de 128 à 1 024 pixels.
- Le déclencheur `profiles_enqueue_avatar` met l'ancienne photo en file de suppression quand elle est remplacée, quand un avatar ou les initiales la remplacent, et quand le compte est supprimé (`tests/avatar.test.ts`).
- `/api/v1/me` expose `avatarPreset` ; `PATCH /api/v1/me` l'accepte, et revient aux initiales avec `avatarPreset` et `avatarUrl` à `null`.
- `POST /api/v1/me/avatar` (multipart, champ `file`) reçoit la photo de l'app native et appelle le même `saveAvatar` que l'action du web : corps borné avant analyse (4 Mo et les délimiteurs), 20 envois par heure et par compte, rien de l'image dans les journaux (`tests/avatar-route.test.ts`).

## Dans l'app native

Réglages, rubrique Profil (`apps/mobile/app/settings/profil.tsx`, `src/features/avatar-editor.tsx`) : « Choisir dans mes photos » ou « Prendre une photo », puis l'éditeur carré du téléphone (`expo-image-picker`, `allowsEditing`) pour déplacer et zoomer ; la photo est ramenée au carré central si besoin, réduite à 512 px et réencodée en JPEG par `react-native-nitro-image`, déjà embarqué (`src/lib/avatar-photo.ts`, `avatar-upload.ts`). Aucune dépendance ajoutée : pas d'`expo-image-manipulator`, pas de rotation par quarts de tour comme sur le web. La galerie « Le groupe » et « Animaux » suit, puis « Revenir aux initiales ».

Un seul composant, `src/ui/avatar.tsx` : le bouton des réglages en haut de chaque onglet, le sommaire des réglages, la liste des athlètes, les commentaires, les annonces et l'invitation. Comme sur le web, la grille du suivi n'en porte pas sur téléphone : la colonne sert à lire le nom.

## La banque d'animaux

Les douze animaux (renard, chat, chien, ours, lapin, chouette, panda, lion, grenouille, manchot, koala, hérisson) sont **dessinés pour Tartan**, en aplats SVG décrits comme des données dans `packages/mascot/src/animals.ts`, que le web (`apps/web/src/components/avatar-art.tsx`) et l'app native (`apps/mobile/src/ui/avatar-art.tsx`) rendent tels quels ; leurs couleurs vivent dans `packages/design-tokens/src/avatars.ts` et chaque aplat se détache de son disque (`tests/avatar-colors.test.ts`). Ils sont embarqués dans l'application : aucun appel à un service tiers à l'affichage, aucune licence ni attribution à porter dans les pages légales.

Banques écartées le 18 novembre 2026, sur leurs pages publiques, sans rien télécharger :

| Banque                                                       | Licence                                                         | Pourquoi écartée                                                                                                                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenMoji                                                     | CC BY-SA 4.0                                                    | Attribution et partage à l'identique ; style d'émoji, que `DESIGN.md` interdit à la place des pictogrammes                                                          |
| Twemoji                                                      | CC BY 4.0 (images)                                              | Attribution ; style d'émoji                                                                                                                                         |
| Fluent Emoji (Microsoft)                                     | MIT                                                             | Style d'émoji, dégradés dans la version couleur                                                                                                                     |
| Packs d'avatars animaux vendus (GetIllustrations et voisins) | Licences commerciales payantes, limitées en nombre de personnes | Payant, licence restrictive                                                                                                                                         |
| Kenney, Animal Pack                                          | CC0                                                             | Licence claire, mais dessins de jeu vidéo d'un autre trait que le groupe, à télécharger depuis une archive tierce ; non retenu sans l'avoir comparé fichier en main |

Aucune banque libre trouvée ne réunissait une licence sans attribution, un style d'aplats compatible avec le groupe et un poids négligeable.
