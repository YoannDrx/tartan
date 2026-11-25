-- Ces deux fiches de l’édition 5 utilisaient la convention de charge générique avant la relecture.
-- La copie du guide permet de reconnaître intégralement la fiche commune historique.
BEGIN;
SELECT pg_advisory_xact_lock(176843, 150);

WITH canonical(catalog_key, guide) AS (
  VALUES
    ('goblet-squat', $guide${
  "catalogKey": "goblet-squat",
  "version": 5,
  "family": "strength",
  "level": "beginner",
  "objective": "Apprendre la flexion de jambes avec une charge tenue devant soi.",
  "setup": [
    "Tiens une kettlebell à deux mains contre la poitrine, pieds écartés dans une position confortable."
  ],
  "steps": [
    "Garde les coudes près du corps et le pied entier en appui.",
    "Descends le bassin entre les pieds sans arrondir le bas du dos.",
    "Pousse dans le sol pour revenir debout."
  ],
  "breathing": "Prépare le tronc avant la répétition et garde une respiration contrôlée ; évite une apnée prolongée sur toute la série.",
  "mistakes": [
    "Éloigner la charge du thorax.",
    "Chercher la profondeur au prix d'un dos qui s'arrondit."
  ],
  "easier": "S'asseoir puis se relever d'un banc sans charge.",
  "progression": "Passer au squat avant avec barre après apprentissage de la prise.",
  "counting": {
    "unit": "repetitions",
    "sides": "total",
    "explanation": "Une répétition correspond à un cycle complet du mouvement décrit. La quantité indiquée est le total de la série."
  },
  "loadExplanation": "Charge externe : indique la masse du kettlebell utilisé en kg.",
  "illustration": {
    "status": "draft",
    "path": "/exercise-guides/goblet-squat-v5.svg",
    "alt": "Goblet squat : positions clés du mouvement, de l'installation à la fin du geste.",
    "positions": [
      "Tiens une kettlebell à deux mains contre la poitrine, pieds écartés dans une position confortable.",
      "Garde les coudes près du corps et le pied entier en appui.",
      "Descends le bassin entre les pieds sans arrondir le bas du dos.",
      "Pousse dans le sol pour revenir debout."
    ],
    "source": "tartan-original",
    "rights": "Tartan"
  }
}$guide$::jsonb),
    ('kettlebell-swing', $guide${
  "catalogKey": "kettlebell-swing",
  "version": 5,
  "family": "strength",
  "level": "intermediate",
  "objective": "Développer une extension de hanche rapide en balançant la kettlebell jusqu'à hauteur de poitrine.",
  "setup": [
    "Kettlebell posée devant toi, pieds un peu plus larges que les hanches ; vérifie que la zone devant et derrière est libre."
  ],
  "steps": [
    "Recule les hanches et lance la kettlebell entre les cuisses, bras longs.",
    "Redresse vivement les hanches pour envoyer la kettlebell jusqu'à hauteur de poitrine.",
    "Laisse-la redescendre et accompagne-la en reculant les hanches, sans arrondir le dos."
  ],
  "breathing": "Prépare le tronc avant la répétition et garde une respiration contrôlée ; évite une apnée prolongée sur toute la série.",
  "mistakes": [
    "Lever la kettlebell avec les bras.",
    "Fléchir les genoux comme un squat."
  ],
  "easier": "Soulevé de terre à la kettlebell pour apprendre la charnière.",
  "progression": "Augmenter la charge en gardant la même hauteur de balancier.",
  "counting": {
    "unit": "repetitions",
    "sides": "total",
    "explanation": "Une répétition correspond à un cycle complet du mouvement décrit. La quantité indiquée est le total de la série."
  },
  "loadExplanation": "Charge externe : indique la masse du kettlebell utilisé en kg.",
  "illustration": {
    "status": "draft",
    "path": "/exercise-guides/kettlebell-swing-v5.svg",
    "alt": "Swing kettlebell : positions clés du mouvement, de l'installation à la fin du geste.",
    "positions": [
      "Kettlebell posée devant toi, pieds un peu plus larges que les hanches ; vérifie que la zone devant et derrière est libre.",
      "Recule les hanches et lance la kettlebell entre les cuisses, bras longs.",
      "Redresse vivement les hanches pour envoyer la kettlebell jusqu'à hauteur de poitrine.",
      "Laisse-la redescendre et accompagne-la en reculant les hanches, sans arrondir le dos."
    ],
    "source": "tartan-original",
    "rights": "Tartan"
  }
}$guide$::jsonb)
)
UPDATE exercises AS x
SET guide = canonical.guide || jsonb_build_object('technicalReview', 'approved'::text),
    updated_at = CURRENT_TIMESTAMP
FROM canonical
WHERE x.catalog_key = canonical.catalog_key
  AND x.catalog_version = 5 AND x.organization_id IS NULL AND x.deleted_at IS NULL
  AND x.guide - 'technicalReview' = jsonb_set(
    canonical.guide, '{loadExplanation}',
    to_jsonb('Indique la charge externe affichée en kg ; les valeurs de machines différentes ne sont pas directement comparables.'::text)
  )
  AND (
    (x.catalog_key = 'goblet-squat' AND x.guide->>'technicalReview' = 'approved' AND NOT EXISTS (
      SELECT 1 FROM platform_settings
      WHERE key = 'exerciseReview:goblet-squat:v5:text:v5' AND value = 'false'::jsonb
    ))
    OR (x.catalog_key = 'kettlebell-swing' AND x.guide->>'technicalReview' IN ('pending', 'approved') AND (
      SELECT COUNT(*) FROM platform_settings
      WHERE key IN ('exerciseReview:kettlebell-swing:v5:text:v5',
                    'exerciseReview:kettlebell-swing:v5:motion:v2',
                    'exerciseReview:kettlebell-swing:v5:image:v1')
        AND value = 'true'::jsonb
    ) = 3)
  );
COMMIT;
