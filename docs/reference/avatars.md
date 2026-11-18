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
- `/api/v1/me` expose `avatarPreset` pour le mobile, qui n'est pas encore branché ; `PATCH /api/v1/me` l'accepte.

## La banque d'animaux

Les douze animaux (renard, chat, chien, ours, lapin, chouette, panda, lion, grenouille, manchot, koala, hérisson) sont **dessinés pour Tartan**, en aplats SVG, dans `apps/web/src/components/avatar-art.tsx` ; leurs couleurs vivent dans `packages/design-tokens/src/avatars.ts` et chaque aplat se détache de son disque (`tests/avatar-colors.test.ts`). Ils sont embarqués dans l'application : aucun appel à un service tiers à l'affichage, aucune licence ni attribution à porter dans les pages légales.

Banques écartées le 18 novembre 2026, sur leurs pages publiques, sans rien télécharger :

| Banque                                                       | Licence                                                         | Pourquoi écartée                                                                                                                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenMoji                                                     | CC BY-SA 4.0                                                    | Attribution et partage à l'identique ; style d'émoji, que `DESIGN.md` interdit à la place des pictogrammes                                                          |
| Twemoji                                                      | CC BY 4.0 (images)                                              | Attribution ; style d'émoji                                                                                                                                         |
| Fluent Emoji (Microsoft)                                     | MIT                                                             | Style d'émoji, dégradés dans la version couleur                                                                                                                     |
| Packs d'avatars animaux vendus (GetIllustrations et voisins) | Licences commerciales payantes, limitées en nombre de personnes | Payant, licence restrictive                                                                                                                                         |
| Kenney, Animal Pack                                          | CC0                                                             | Licence claire, mais dessins de jeu vidéo d'un autre trait que le groupe, à télécharger depuis une archive tierce ; non retenu sans l'avoir comparé fichier en main |

Aucune banque libre trouvée ne réunissait une licence sans attribution, un style d'aplats compatible avec le groupe et un poids négligeable.
