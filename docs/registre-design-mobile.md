# Registre design mobile

Passe du 1er novembre 2026, méthode du § 9.12 : 1. Cadrer (UI/UX Pro Max), 2. Composer (Frontend Design), 3. Critiquer et 4. Affiner (Impeccable, puis Frontend Design), 5. Valider (liste de contrôle et audit).

**Limites de cette passe, à lire avant le tableau :**

- Cadrage et composition ont été menés une fois pour l'ensemble de l'app, puis appliqués écran par écran. Seuls les écrans marqués « nouveau » ont été composés de zéro.
- Le binaire `impeccable context` n'a pas pu s'exécuter (droit refusé). Critique et audit suivent ses références (`craft-floor`, `audit.native`) à la main, sans détecteur automatique.
- Captures sur simulateur iPhone 16e, iOS 26.3, compte démo, à travers un proxy local : il simule Mux pour la vidéo et transmet le reste à l'API locale. **Aucune capture Android, aucun VoiceOver ni TalkBack réellement joué.**
- « Oui » signifie : capture regardée à l'écran avec du contenu réel, pas seulement l'état de chargement.

| Écran | Fichier | Étapes faites | Capture vérifiée |
| --- | --- | --- | --- |
| Connexion | `app/(auth)/sign-in.tsx` | 1 à 5 | Oui, dont message de confirmation d'adresse |
| Création d'espace | `app/(auth)/onboarding.tsx` | 1 à 5 | Oui, étape profil, compte démo présenté sans espace par le proxy d'essai (aucun compte créé) |
| Retour de lien magique | `app/(auth)/callback.tsx` | 1 à 5 | Oui, état d'échec ; l'état de chargement est un passage |
| Invitation reçue | `app/i/[token].tsx` | 1 à 5 | Oui, vrai lien de groupe |
| Introuvable | `app/+not-found.tsx` | 1 à 5 | Oui |
| Aujourd'hui | `app/(athlete)/today.tsx` | 1 à 5 | Oui, aussi en très grand texte |
| Calendrier athlète | `app/(athlete)/agenda.tsx` | 1 à 5 | Oui |
| Progrès | `app/(athlete)/progress.tsx` | 1 à 5 | Oui, aussi en très grand texte |
| Mes sauts | `app/(athlete)/jumps.tsx` | 1 à 5 | Oui |
| Annonces athlète | `app/(athlete)/news.tsx` | 1 à 5 | Oui, aussi en très grand texte |
| Mode séance | `app/session/[id].tsx` | 1 à 5 | Oui |
| Feuille de validation | `src/features/validation-sheet.tsx` | 1 à 5 | Oui, ouverte par « Modifier » sur une séance validée |
| Suivi du groupe | `app/(coach)/tracking.tsx` | 1 à 5 | Oui |
| Feuille d'un athlète, depuis le suivi | `app/(coach)/tracking.tsx` | 1 à 5 | Oui |
| Calendrier coach | `app/(coach)/planning.tsx` | 1 à 5 | Oui |
| Exercices | `app/(coach)/exercises.tsx` | 1 à 5 | Oui. Reste ouvert : un nom très long se serre contre l'étiquette de catégorie |
| Vidéos | `app/(coach)/videos.tsx` | 1 à 5 | Oui |
| Annonces coach | `app/(coach)/announcements.tsx` | 1 à 5 | Oui |
| Détail d'une séance coach | `app/coach-session/[id].tsx` | 1 à 5 | Oui |
| Inviter des athlètes (nouveau) | `app/invite.tsx` | 1 à 5 | Oui, QR code relu par CoreImage |
| Athlètes (nouveau) | `app/athletes/index.tsx` | 1 à 5 | Oui |
| Fiche athlète (nouveau) | `app/athletes/[id].tsx` | 1 à 5 | Oui, toutes les sections sur la vraie API locale |
| Modifier ou créer un exercice (nouveau) | `app/exercise/[id].tsx` | 1 à 5 | Oui, création et modification écrites en base |
| Relance du parent (nouveau) | `src/features/parental-pending.tsx` | 1 à 5 | Oui, avec un accord en attente ajouté puis retiré de la base de démo |
| Filmer | `app/capture.tsx` | 1 à 5 | Oui, avec un vrai clip à 240 i/s. Caméra non vue : le simulateur n'en a pas |
| Analyse vidéo | `app/video/[id].tsx` | 1 à 5 | Oui, lecture à 0,5× et 1×, annotation, signalement |
| Réglages | `app/settings.tsx` | 1 à 5 | Oui, coach et athlète |

## Corrections issues de la critique

| Gravité | Écart | Correction |
| --- | --- | --- |
| Élevée | Capitales au-dessus des sections, contraires à `DESIGN.md` et au § 9.11 | `section` passe en Barlow Condensed SemiBold 20/24, sans capitales, comme le web |
| Élevée | Confirmation d'adresse affichée comme une erreur, en rouge | Message distinct, ton normal, annonce polie |
| Élevée | Champs de bas d'écran cachés par le clavier sur iOS | `automaticallyAdjustKeyboardInsets` sur les écrans défilants |
| Moyenne | « Filmer ici » actif sans caméra : le bouton ne faisait rien | Masqué s'il n'y a pas de caméra |
| Moyenne | Consigne « sur tartan.coach » affichée pendant le chargement des exercices | Retirée : l'exercice se crée et se modifie dans l'app |
| Faible | Libellés à 11 px dans la grille et la timeline | 12 px. Seule la barre d'onglets reste à 11, comme le prévoit `DESIGN.md` |

## Contrôles

| Contrôle | Résultat |
| --- | --- |
| `accessibilityLabel` | Boutons, puces et rangées relus dans le code des écrans ci-dessus ; icônes décoratives masquées |
| Cibles de 44 pt | `TOUCH` = 44 sur boutons, icônes et champs ; pastille de 36 portée à 44 par `hitSlop` ; cellules de grille 46 × 56 |
| Tailles de texte | Pas de clipping au redémarrage en taille « accessibility-large ». Un changement à chaud coupe le texte jusqu'au prochain rendu complet : artefact à vérifier sur vrai iPhone |
| Contraste | Blanc sur rouge 5,0:1, repris de `DESIGN.md`, non remesuré |
