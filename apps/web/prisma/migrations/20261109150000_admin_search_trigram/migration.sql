-- Recherche de la console d'administration : un ILIKE '%terme%' ne peut pas utiliser un index B-tree. Additif.
-- pg_trgm est une extension « trusted » (PostgreSQL 13 et plus) : le droit CREATE sur la base suffit.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "user_email_trgm_idx" ON "user" USING GIN ("email" gin_trgm_ops);
CREATE INDEX "user_name_trgm_idx" ON "user" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "organizations_name_trgm_idx" ON "organizations" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "audit_log_action_trgm_idx" ON "audit_log" USING GIN ("action" gin_trgm_ops);
