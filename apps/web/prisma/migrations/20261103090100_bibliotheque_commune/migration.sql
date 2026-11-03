-- Bibliothèque commune : organization_id vide, visible par tous les espaces et non modifiable par eux.
-- Les vidéos restent chez YouTube et Instagram : Tartan n'en garde que la référence et l'auteur.

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('37640c34-7753-5a65-bdc4-2025b086d945', NULL, 'Mobilité de hanche, débutant et avancé', 'mobility', ARRAY['hanche']::text[], ARRAY['Deux versions : débutant et avancé']::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "instagram_code", "author", "updated_at")
VALUES ('73e5972b-7b94-5568-811c-bdc052a6c1f6', '37640c34-7753-5a65-bdc4-2025b086d945', 'instagram', 'DeKl2zopMw9', 'zhamediperformance', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('0f79980d-006c-51f2-8c1b-d5465b2d874f', NULL, 'Renforcement des hanches assis au sol', 'mobility', ARRAY['hanche']::text[], ARRAY[]::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "instagram_code", "author", "updated_at")
VALUES ('6436d297-87bd-5fa6-87c9-c01f0d228cbf', '0f79980d-006c-51f2-8c1b-d5465b2d874f', 'instagram', 'DeGC80pC82E', 'cleopatra.niaa', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('81c7796f-50db-501d-b0bc-786ebc714766', NULL, 'Exercice de hanche au sol, jambe sur caisson', 'strength', ARRAY['hanche']::text[], ARRAY[]::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "instagram_code", "author", "updated_at")
VALUES ('302cc424-ea2f-51a7-9afa-0437b4d3c854', '81c7796f-50db-501d-b0bc-786ebc714766', 'instagram', 'DdZM9s7SJOF', 'gauravtyagicoach', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('945c7837-c684-57f0-9b94-82f89da9f0e0', NULL, 'Pliométrie en fente sur caisson', 'plyo', ARRAY['explosivité']::text[], ARRAY['Maîtriser la position de fente', 'Vitesse d''exécution maximale']::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "instagram_code", "author", "updated_at")
VALUES ('285b0d05-9982-533c-b45c-245f0949b152', '945c7837-c684-57f0-9b94-82f89da9f0e0', 'instagram', 'DYzRfXosYt_', 'teamascension_ifbb_pro', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('f8e90e55-0385-56fb-bfb4-065f61ad5351', NULL, 'Fente à genou, disque au-dessus de la tête', 'mobility', ARRAY['hanche', 'haies']::text[], ARRAY[]::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "instagram_code", "author", "updated_at")
VALUES ('114d2c31-bb6e-53ff-a9c3-787f6a2e09d1', 'f8e90e55-0385-56fb-bfb4-065f61ad5351', 'instagram', 'DWRyecNCHkx', 'ukrainian_hurdlers_group', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('dd44140e-42e5-50fb-a436-1d8b5953b164', NULL, 'Flossing des ischios à genoux', 'mobility', ARRAY['ischios']::text[], ARRAY[]::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "instagram_code", "author", "updated_at")
VALUES ('95467484-e6f4-539d-8a16-385acca91b1f', 'dd44140e-42e5-50fb-a436-1d8b5953b164', 'instagram', 'DdxEVRSxuJr', 'kbdathletes', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('ae58b090-002c-542c-afe2-8a65289e0d56', NULL, 'Renforcement de hanche debout sur une jambe', 'strength', ARRAY['hanche']::text[], ARRAY['Mobilité, stabilité et isométrie vont ensemble']::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "instagram_code", "author", "updated_at")
VALUES ('e4b0d4c2-6113-5955-a0b3-054269554d96', 'ae58b090-002c-542c-afe2-8a65289e0d56', 'instagram', 'DeA9z3yNYCk', 'maximusvam', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('0de5f2e9-301c-5188-bc99-cba99cc1864e', NULL, 'Tirage haut d''épaulé : la consigne du pantalon', 'strength', ARRAY['haltérophilie']::text[], ARRAY['Équilibre sur tout le pied', 'Barre à la verticale, comme si tu remontais ton pantalon', 'Ne bascule pas des talons vers les orteils']::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "instagram_code", "author", "updated_at")
VALUES ('0403372c-25f5-58b1-bbe2-97ad1c4ca875', '0de5f2e9-301c-5188-bc99-cba99cc1864e', 'instagram', 'DeVl-OwPJUI', 'whiteboard_daily', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('e25735c2-4174-5398-9d25-c67bf39623b3', NULL, 'Routine cheville en 10 minutes', 'mobility', ARRAY['cheville']::text[], ARRAY['Rotations de cheville contrôlées, 2 min', 'Relevés de pointes dos au mur, 3 × 20', 'Mollet étiré en charge sur une marche, 60 s', 'Équilibre sur une jambe, yeux fermés, 3 × 30 s', 'Sauts latéraux sur une jambe, 3 × 10']::text[], '{"duration_s": 600}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "instagram_code", "author", "updated_at")
VALUES ('07f4fce6-a567-569c-8383-b0fc45897658', 'e25735c2-4174-5398-9d25-c67bf39623b3', 'instagram', 'Dbq862ptfM6', 'svengirlando', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('b0231454-0121-52bc-a978-bcbe32c7508d', NULL, 'Enchaînement de mobilité en fente', 'mobility', ARRAY['hanche']::text[], ARRAY['Deux versions : débutant et avancé']::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "instagram_code", "author", "updated_at")
VALUES ('4445f993-ce0b-5096-9d5e-119bcf59a622', 'b0231454-0121-52bc-a978-bcbe32c7508d', 'instagram', 'Dea6AeAMHDw', 'grapefitt', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('b4857e08-036d-502a-90d8-202375e78a56', NULL, 'Mobilité de cheville avec kettlebell', 'mobility', ARRAY['cheville']::text[], ARRAY[]::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "instagram_code", "author", "updated_at")
VALUES ('f6f0b0c2-5cf7-5670-b478-b4eb61dc264c', 'b4857e08-036d-502a-90d8-202375e78a56', 'instagram', 'DdjAWIQR8ux', 'gymjimpt', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('a4e8c41e-6023-568b-8ed4-6fa54f0d5d9e', NULL, '5 essentiels pour la mobilité de hanche', 'mobility', ARRAY['hanche']::text[], ARRAY['Squat en position du cavalier', 'Jefferson curl', 'Fente profonde ATG', 'Squat cosaque', 'Rotation interne de hanche, pied décollé']::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "instagram_code", "author", "updated_at")
VALUES ('b85df077-6977-584c-bdc0-8c418aceba29', 'a4e8c41e-6023-568b-8ed4-6fa54f0d5d9e', 'instagram', 'Dew1490NY4_', 'baptistebaronsp', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('a0ae423b-c58f-5396-b603-95ee3645e4fe', NULL, 'Relevés de jambe assis au sol', 'strength', ARRAY['hanche']::text[], ARRAY[]::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "instagram_code", "author", "updated_at")
VALUES ('476c2e8a-2628-54c2-9173-89480ceb5ef6', 'a0ae423b-c58f-5396-b603-95ee3645e4fe', 'instagram', 'De20szbzR0R', 'kbdathletes', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('298623a3-0017-5197-8eac-2cc82852e83e', NULL, 'Fente latérale profonde avec haltère', 'mobility', ARRAY['hanche']::text[], ARRAY[]::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "instagram_code", "author", "updated_at")
VALUES ('2d1aa6b9-6d74-55b3-8c68-9cfdcb336ab3', '298623a3-0017-5197-8eac-2cc82852e83e', 'instagram', 'De4QUywN_QP', 'realtalkwithmario', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('ac829309-1df4-5126-af17-099ba6ee5476', NULL, 'Technique de l''épaulé-jeté', 'strength', ARRAY['haltérophilie']::text[], ARRAY[]::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "instagram_code", "author", "updated_at")
VALUES ('2edf2139-03d8-5061-b843-ece0b47518bb', 'ac829309-1df4-5126-af17-099ba6ee5476', 'instagram', 'DZ6g9Mup3-9', 'chenghui.xu_', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('5187b0a5-ff48-5254-9f43-fcc485192a5d', NULL, 'Mobilité pour le front rack', 'mobility', ARRAY['épaule', 'haltérophilie']::text[], ARRAY[]::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "instagram_code", "author", "updated_at")
VALUES ('85d45db6-6480-5345-bf45-0d34d424d110', '5187b0a5-ff48-5254-9f43-fcc485192a5d', 'instagram', 'De9VyR9g6T0', 'coachthaix', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('c053f0da-6df2-55af-87be-c6c4ce30ecd2', NULL, 'Tuto arraché au manche', 'strength', ARRAY['haltérophilie']::text[], ARRAY[]::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "instagram_code", "author", "updated_at")
VALUES ('4951adf0-4f83-515e-8465-0a73d116943f', 'c053f0da-6df2-55af-87be-c6c4ce30ecd2', 'instagram', 'De3otXbNfpX', 'nopainlougain', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('e803f572-0db8-55a8-b734-a8cadc7e96b0', NULL, 'Mobilité complète, 30 minutes', 'mobility', ARRAY['corps entier']::text[], ARRAY[]::text[], '{"duration_s": 1800}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "youtube_id", "author", "updated_at")
VALUES ('f4dce1d7-2747-59e8-a7b5-e581cce47bbe', 'e803f572-0db8-55a8-b734-a8cadc7e96b0', 'youtube', 'gXs3GRt3QpY', 'EDR Fitness', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('ca339bcd-e7ec-5dd7-9171-6bedadadf854', NULL, '4 exercices pour les genoux', 'mobility', ARRAY['genou']::text[], ARRAY[]::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "youtube_id", "author", "updated_at")
VALUES ('122ffc62-7268-598a-8dbd-ce5f77bfade1', 'ca339bcd-e7ec-5dd7-9171-6bedadadf854', 'youtube', '3m4KKX0i_Ls', 'Hem Ton Kiné', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('0ab4cf50-ea36-510c-b976-54adfea7a2e8', NULL, 'Squat cosaque à la kettlebell', 'strength', ARRAY['hanche']::text[], ARRAY[]::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "youtube_id", "author", "updated_at")
VALUES ('3e624c10-5d1c-5714-bbe7-38d3139b0c2c', '0ab4cf50-ea36-510c-b976-54adfea7a2e8', 'youtube', 'cR4mbpgcDME', 'Human Kinetics', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('03a42923-d51f-55a6-86c9-27995abb840f', NULL, 'Bascule de hanches 90/90 à la kettlebell', 'mobility', ARRAY['hanche']::text[], ARRAY[]::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "youtube_id", "author", "updated_at")
VALUES ('fa495671-79c9-5ff4-9000-79b8522f3432', '03a42923-d51f-55a6-86c9-27995abb840f', 'youtube', 'iIP3A55sE9M', 'Craig Edwards', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('048c9334-a46e-531c-8678-573a717ce427', NULL, 'Soulevé de terre roumain sur une jambe', 'strength', ARRAY['ischios']::text[], ARRAY[]::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "youtube_id", "author", "updated_at")
VALUES ('e7ea7dba-8431-5aed-9ae6-8d6f29dc7910', '048c9334-a46e-531c-8678-573a717ce427', 'youtube', 'opvwjIol9Ts', 'Catalyst Athletics', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('73d21489-90b7-5650-b569-f5efbd21a39b', NULL, 'Avion de hanche à la kettlebell', 'mobility', ARRAY['hanche']::text[], ARRAY[]::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "youtube_id", "author", "updated_at")
VALUES ('248b8b0f-7941-57ac-83c5-46834ab8fd86', '73d21489-90b7-5650-b569-f5efbd21a39b', 'youtube', '3ZD22BtYCT0', 'The Movement Collective', CURRENT_TIMESTAMP);

INSERT INTO "exercises" ("id", "organization_id", "name", "category", "tags", "cues", "default_prescription", "updated_at")
VALUES ('da77c82f-8403-5e39-9715-fceb16a8f8d0', NULL, 'Marche des fléchisseurs de hanche à la kettlebell', 'strength', ARRAY['hanche']::text[], ARRAY[]::text[], '{}'::jsonb, CURRENT_TIMESTAMP);
INSERT INTO "exercise_media" ("id", "exercise_id", "kind", "youtube_id", "author", "updated_at")
VALUES ('c29b97c1-260e-5f3b-a1b5-afba6d14c823', 'da77c82f-8403-5e39-9715-fceb16a8f8d0', 'youtube', 'D3pd7YgAus8', 'Versus the Mind', CURRENT_TIMESTAMP);
