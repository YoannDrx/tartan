# Tartan — design system

Lu à chaque session de design. Source produit : `PRODUCT.md` ; état effectivement livré : `docs/livraison-v1-1.md`.

**Décision du fondateur du 7 novembre 2026 — V1.1.** Les surfaces de travail deviennent claires, la navigation compacte et la couleur porte les séances, catégories et états utiles. Cette décision remplace l’obligation du 3 novembre d’un fond vif et de cartes encre sur chaque écran. L’identité expressive reste disponible sur les accueils, le site et la célébration. La sobriété des espaces de travail de Nolio est une référence d’usage, sans reprise de sa marque ni de ses composants.

**Intention.** Un carnet de préparation physique pour l’athlétisme : lire la semaine, préparer une séance, individualiser et comprendre le réalisé. Rouge piste comme signature, citron comme accent, typographie Barlow. Force, vitesse, puissance, endurance et mobilité ont la même légitimité ; le saut en hauteur conserve ses outils spécialisés dans leur contexte.

## Deux régimes, une identité

### Travail

Calendrier, suivi, constructeur, bibliothèque, fiches athlètes, progrès, listes de vidéos, annonces, réglages et formulaires utilisent un fond craie, des surfaces blanches et du texte encre. Les séparations sont fines ; les chiffres sont tabulaires. Une liste structurée est préférable à une succession de cartes décoratives. Le contenu et l’action principale sont visibles tôt, sans titre de 80 px ni mot systématiquement surligné.

Les titres d’écran font 28–32 px, les titres de section 20–22 px, le texte 15–16 px. La navigation garde des cibles de 44 px au minimum. Le rouge identifie l’action principale ou la sélection ; le citron reste un accent et la couleur de la célébration. Une couleur n’est jamais le seul moyen de comprendre un état.

Sur desktop, les comparaisons peuvent utiliser plusieurs colonnes et les détails un panneau ; sur téléphone, ils se lisent dans un écran dédié et une colonne. Les interfaces natives appliquent les mêmes rôles et intitulés. Les formulaires, feuilles, menus et dialogues suivent le contexte clair, y compris les éléments rendus dans un portail.

### Expression et immersion

Le site et l’accueil athlète peuvent garder les aplats et la mascotte, avec une représentation équilibrée de la préparation physique. Le parcours présenté est « préparer → individualiser → réaliser → progresser ». Les captures représentent les fonctions réellement disponibles. La hauteur ne constitue plus l’unique récit du produit.

La lecture/analyse vidéo, la capture et le mode séance restent encre : la couleur du fond ne doit pas distraire du geste. La célébration de validation reste citron. Une route historique conserve son adresse tant qu’une redirection compatible n’a pas été ajoutée.

## Palette et rôles

Source unique : `packages/design-tokens/src/index.ts`. Les valeurs CSS sont un miroir contrôlé par les tests. Aucun hexadécimal dans les composants.

| Rôle        | Couleur   | Usage                                      |
| ----------- | --------- | ------------------------------------------ |
| Piste       | `#C4442B` | Marque et action principale sur clair      |
| Piste forte | `#9E3320` | Liens et états de survol sur clair         |
| Encre       | `#15161A` | Texte, immersion, navigation expressive    |
| Craie       | `#F2F3F1` | Fond de travail                            |
| Blanc       | `#FFFFFF` | Surfaces de travail                        |
| Citron      | `#C6F432` | Accent, célébration et sélection sur encre |

Les jetons `work` définissent le contexte de travail ; `scene` conserve le contexte expressif et immersif. Les composants utilisent la palette locale : texte, texte secondaire, surface, séparateur, contour de contrôle, action, lien, focus et statut. Un composant partagé ne suppose jamais que sa surface est sombre.

Les mondes historiques Piste, Couloir, Craie, Soleil et Nuit restent des palettes expressives ; ils ne dictent plus la couleur des écrans de travail. La navigation quotidienne est claire, avec sélection rouge et libellé explicite. L’accueil expressif peut garder sa navigation encre. Les e-mails restent clairs dans toutes les messageries.

## Typographie et rythme

Barlow pour le texte ; Barlow Condensed pour les titres et chiffres. Titres de travail courts et alignés à gauche, sans mot isolé au marqueur. Le marqueur peut rester sur les titres expressifs du site et de l’accueil.

Grille de 4 px ; espacements de 4 à 64 px. Marge latérale mobile 16 px, desktop 24 px. Rayons cohérents : boutons 14 px, cartes 20 px ; pas de carte dans une carte. Cibles tactiles de 44 × 44 px. Aplats et bordures plutôt qu’ombres, sauf éléments flottants.

La couleur des séances et catégories sert la lecture du calendrier ; une spécialité ne bénéficie pas systématiquement d’un poids visuel supérieur. Les volumes et intensités conservent leurs unités et leur couverture de données.

## Composants et parcours

- Une action principale explicite par étape ; publication principale, brouillon secondaire, options avancées regroupées.
- Boutons secondaires sobres, contours et focus visibles sur leur surface réelle.
- Champs avec libellé permanent, erreur proche et annoncée, clavier suivant le thème ; les valeurs ne disparaissent pas sur une erreur.
- Cartes/listes de séance : titre, date, destinataires, état et catégorie avant les métadonnées secondaires.
- Contexte groupe/athlète/semaine conservé lors d’une consultation et d’un retour.
- Graphiques accompagnés d’une synthèse et d’un tableau ; aucun résultat manquant présenté comme mesuré.
- Installation proposée au bon moment, refermable ; aucune action cachée sous les barres fixes.
- Vidéo générale : « Vidéos » et « Analyse technique ». Barre, hauteur et phases techniques de saut seulement dans le contexte hauteur.

## Mouvement et mascotte

**Un seul grand moment animé : la validation d’une séance faite.** La célébration peut intégrer les records confirmés de cette séance. Pas de seconde animation dans l’historique, de son ni de rejeu après synchronisation. Une validation partielle ne déclenche pas cette célébration. Réduction des animations respectée.

Pas d’animation d’apparition dans les écrans de travail. Transitions de 150 à 250 ms lorsqu’elles expliquent une interaction. La mascotte reste décorative dans les accueils, états vides et la validation ; elle ne remplace jamais une information ou une action.

## Recette

Chaque écran passe par UI/UX Pro Max, Frontend Design et Impeccable, en conservant le contexte produit. Les suggestions génériques de landing ou de styles décoratifs ne remplacent pas ces décisions.

Vérifier 390, 768 et 1440 px, clavier, zoom 200 %, contenus longs, 30/60/120 athlètes et barres fixes. Contraste texte 4,5:1, gros texte 3:1, contrôles/focus 3:1. Vérifier les portails, menus et retours d’erreur dans le bon thème. VoiceOver/TalkBack et appareils physiques restent des recettes distinctes des exports et tests automatisés.

## Interdits (exigence « aucun AI slop »)

Un écran qui contient l'un de ces travers n'est pas terminé.

- Dégradés, texte en dégradé, halos colorés.
- Verre dépoli et flou décoratif.
- Grilles de cartes identiques (icône + titre + texte), cartes imbriquées.
- Gabarit « gros chiffre + petit libellé + statistiques ».
- Surtitre en capitales au-dessus d'un titre.
- Bordure colorée épaisse à gauche des cartes et alertes.
- Émojis ou caractères Unicode à la place d'icônes (Lucide, plus pictogrammes métier dessinés).
- Ombres dures ou lourdes.
- Police système comme voix de la marque.
- Faux contenu (lorem ipsum, statistiques inventées). Contenu réel du pilote ou repère explicite [À DÉFINIR].
- Animations d'apparition sur les écrans de l'application.

## À vérifier sur chaque écran

Contraste 4,5:1 (3:1 gros titres), cibles 44 px, focus clavier visible, dans le monde réel de l'écran. États : chargement, vide, erreur, désactivé, survol, contenu long, contenu réel. Éléments oubliés stylés : sélection de texte, barres de défilement, anneaux de focus, chiffres tabulaires. Textes dans la langue du coach et de l'athlète ; les boutons disent ce qu'ils font, les erreurs disent quoi faire.
