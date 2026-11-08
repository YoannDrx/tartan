# Vidéo de préparation physique — 8 novembre 2026

Lot A de la PR #45, développé depuis `9cf9c83`. Migrations, URLs historiques, données existantes et configuration de production inchangées.

## Comportement

La capture native propose une vidéo sans barre par défaut. Avant ce changement, même un exercice de force recevait une barre de 160 cm et un essai réussi. Désormais, seules les vidéos pour lesquelles le coach active « Outils de saut en hauteur » reçoivent un essai. Replier l'option retire l'association lors de l'envoi, même si les champs conservent leurs valeurs pour une prochaine utilisation explicite. Le bouton d'enregistrement d'un saut sans vidéo n'apparaît que dans ce contexte.

Les listes web et natives emploient « Analyse technique » sans signaler une hauteur manquante. L'import web, l'intitulé de la vidéo accessible et les indications de capture/commentaire utilisent un vocabulaire général. Le pictogramme d'une vidéo sans vignette est un lecteur, pas une barre.

Les remarques temporelles restent disponibles sans phase. Les outils de phase s'activent explicitement ; une sélection masquée est remise à zéro. Les anciennes hauteurs, numéros/résultats d'essai et annotations par phase conservent leur contexte et leurs outils. Une feuille de barres provenant simplement de la même séance ne transforme pas une vidéo générique en vidéo de hauteur. Aucune annotation existante n'est supprimée lorsqu'on replie l'option.

L'écran conserve la surface encre prévue par `DESIGN.md`, les repères citron et les contrôles existants. L'option secondaire est nommée et son état accessible ; aucune nouvelle animation. La revue UI/UX Pro Max porte sur les champs facultatifs et leur dévoilement ; Frontend Design sur la hiérarchie et la conservation de l'identité immersive ; Impeccable sur les travers détectables. L'erreur de lecture ne montre plus un détail de configuration Mux à l'utilisateur.

## Validation

- 101 tests du domaine, dont la reconnaissance du contexte historique et l'absence de classification des remarques génériques.
- 199 tests mobiles, dont l'entrée réellement utilisée par la capture : association explicite, valeurs conservées et suppression de la barre quand le mode est replié.
- Un scénario serveur Postgres vérifie les imports avec `attempt` absent ou nul (aucun essai créé) et une barre explicite conservée. Mux simulé, aucune vidéo envoyée au prestataire.
- Deux parcours navigateur sur build de production : annotation sans phase, sélection puis fermeture sans phase cachée envoyée, persistance SQL, rechargement d'une ancienne phase, import générique. Axe, absence de débordement à 390/768/1440 px et zoom 200 %.
- Parcours vidéo existant réussi sur serveur de développement : fichier local à 240 i/s étiré ×8, douze avances image par image, retour arrière, vitesse 0,1×, annotation de saut après activation explicite.
- Types monorepo, lint web (zéro erreur, quatre avertissements existants), Impeccable (zéro travers) et exports Hermes iOS/Android contrôlés. Le premier lancement local d'Impeccable utilisait un `pnpm` global incompatible : échec explicite, puis relance réussie avec Node 22 et pnpm 10 ; aucun résultat positif n'a été déduit de cet échec.

Recette native sur iPhone 17 Pro simulé, iOS 26.3, API locale 3102, Metro 8083 et base synthétique `tartan_v11_e2e` : connexion → Vidéos → Filmer. Barre, résultat, appuis et enregistrement sans vidéo absents par défaut, visibles après activation puis retirés après désactivation. Le simulateur n'a pas de caméra ; aucun enregistrement/import ni envoi Mux réel n'est revendiqué.

Un second crash du client de développement a été retrouvé à 00 h 30, pendant la période de modifications à chaud : `EXC_BAD_ACCESS` dans `EXPermissionsService registerRequesters:`. La relance et la recette ci-dessus ont réussi. Sa cause et le lien éventuel avec le rechargement restent à établir ; un build sans serveur de développement et les essais physiques sont nécessaires. Ce constat ne permet pas de déclarer la stabilité native acquise.

## Limites

Les captures navigateur utilisent une vidéo synthétique sans flux Mux en production : elles prouvent l'interface et les annotations, pas la lecture chez le prestataire. La lecture est couverte séparément par le fichier local du test de ralenti. Réception réelle, permissions caméra/micro, capture physique, Mux isolé, effacement et VoiceOver/TalkBack restent à éprouver.

La PR demeure en brouillon. Ce lot ne termine ni l'onboarding et la bibliothèque, ni les historiques/records, les phases/analyses ou le planificateur IA.

Captures de recette : [desktop](images/video-generic-desktop.png), [mobile](images/video-generic-mobile.png).
