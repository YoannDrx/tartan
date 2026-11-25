-- Les douze vignettes corrigées de la planche pilote ont été relues le 25 novembre 2026.
-- Ces décisions portent sur l’image de cette édition. Une décision déjà prise dans l’atelier garde la priorité.
INSERT INTO "platform_settings" ("key", "value", "updated_at") VALUES
  ('exerciseReview:curve-pop-up:v6:image:v1', 'true'::jsonb, CURRENT_TIMESTAMP),
  ('exerciseReview:hop-step-stick:v6:image:v1', 'true'::jsonb, CURRENT_TIMESTAMP),
  ('exerciseReview:cone-high-knees:v6:image:v1', 'true'::jsonb, CURRENT_TIMESTAMP),
  ('exerciseReview:snap-down:v6:image:v1', 'true'::jsonb, CURRENT_TIMESTAMP),
  ('exerciseReview:clean-front-rack:v6:image:v1', 'true'::jsonb, CURRENT_TIMESTAMP),
  ('exerciseReview:kb-suitcase:v6:image:v1', 'true'::jsonb, CURRENT_TIMESTAMP),
  ('exerciseReview:band-dorsiflexion:v6:image:v1', 'true'::jsonb, CURRENT_TIMESTAMP),
  ('exerciseReview:easy-jump-rope:v5:image:v1', 'true'::jsonb, CURRENT_TIMESTAMP),
  ('exerciseReview:standing-calf-raise:v5:image:v1', 'true'::jsonb, CURRENT_TIMESTAMP),
  ('exerciseReview:reverse-lunge:v5:image:v1', 'true'::jsonb, CURRENT_TIMESTAMP),
  ('exerciseReview:step-over-cone:v6:image:v1', 'true'::jsonb, CURRENT_TIMESTAMP),
  ('exerciseReview:step-up:v5:image:v1', 'true'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
