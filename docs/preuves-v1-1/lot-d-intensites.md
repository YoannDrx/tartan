# Comparaison des charges et cibles d’intensité

8 novembre 2026, depuis `342e950`, PR #45 en brouillon. Bases locales synthétiques ; aucune migration supplémentaire, aucun appel fournisseur ni activation.

## Règles

Quatre unités séparées : kilogrammes, pourcentage de la référence conservée, cible RPE et cible RIR. Les lignes sont identifiées par exercice, convention de charge et unité. Aucun mélange entre charge externe totale, charge additionnelle et assistance ; aucune moyenne entre exercices différents. Ces observations n’évaluent pas un risque de blessure et ne recommandent pas d’augmenter une charge.

Le prévu résume une observation par occurrence de l’exercice et par athlète. Le réalisé résume les séries de travail faites et renseignées. Les deux pondérations sont annoncées ; une validation simple ne remplit pas le réalisé. Les échauffements et séries non faites sont exclus. Le zéro est une valeur valide, notamment pour le RIR et une charge externe nulle. Moyenne, minimum, maximum et nombre d’observations sur le dénominateur sont visibles. Les observations manquantes gardent leur dénominateur lors de la comparaison à la période précédente.

Les pourcentages réalisés utilisent la valeur, le type et la convention de la référence dans la copie de prescription. Un ancien 3RM conserve la conversion Epley utilisée pour cette prescription. Une référence absente, nulle, de type inconnu, d’un exercice incompatible ou d’une convention différente laisse le pourcentage manquant. Aucune requête de maximum actuel ni reconstitution depuis une charge arrondie. Les kilogrammes saisis restent consultables séparément.

Les cibles RPE/RIR sont des prescriptions du coach. Elles ne sont pas les RPE réalisés de séance, ne lisent pas les notes privées et ne donnent pas lieu à une conversion vers les kilogrammes. Les calculs d’effort ressenti existants restent dans leur section, soumis au consentement santé.

Les anciennes copies sans exercice relié et les séries sans prescription comparable sont comptées comme exclues. Le contrat supplémentaire est facultatif pour la compatibilité des clients. Web et natif utilisent les mêmes règles et la même comparaison temporelle, y compris le périmètre des phases.

## Vérification

- **19 tests domaine réussis**, dont conventions séparées, zéro, échauffement, données absentes, pondérations, références figées, origine invalide et ancien 3RM.
- **16 tests serveur ciblés réussis** : analyse et confidentialité/attribution des phases. La lecture renvoie 40 kg prévus / 40 kg réalisés avec les dénominateurs propres, sans consultation d’un maximum récent ; la cible RPE 7 reste indépendante du RPE réellement déclaré.
- Types monorepo verts, lint sans erreur avec quatre avertissements préexistants, contrôle de design sans travers. Build web de production et types natifs revérifiés après le contrôle 3RM. Export Hermes iOS/Android final réussi.
- **Deux parcours navigateur de production réussis en 35,5 s**, code final : lecture par le client API partagé, sélection kg/RIR/pourcentage, absence de réalisé RIR inventé, état vide de pourcentage, tableaux/chiffres, accès, Axe, 390/768/1440 px et zoom 200 %.

Relecture visuelle des captures [desktop](images/intensity-desktop.png) et [web mobile](images/intensity-mobile.png) : unités au-dessus des chiffres, périodes côte à côte sur desktop et successives sur téléphone, méthodologie repliable et couvertures visibles. Respect de DESIGN.md et contrôle Impeccable. Les skills UI/UX Pro Max et Frontend Design restent absents des répertoires vérifiés ; aucune exécution nouvelle revendiquée. Les exports Hermes et tests web ne remplacent pas VoiceOver/TalkBack ou une recette sur téléphone physique.

Le lot D dispose désormais de son implémentation fonctionnelle pour phases, volumes, charge ressentie consentie, diversité, catégories, mouvements/matériel et intensités homogènes. Sa recette globale et physique reste ouverte. Les lots A et E, configurations externes, juridique, commercialisation et publication stores restent à terminer.
