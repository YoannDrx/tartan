-- File d'effacement durable : une ligne supprimée ne laisse plus de fichier chez un prestataire.
CREATE TABLE "external_deletions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "external_ref" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "not_before" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_token" TEXT,
    "lease_until" TIMESTAMP(3),
    "last_error_code" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_deletions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "external_deletions_provider_external_ref_key" ON "external_deletions"("provider", "external_ref");
CREATE INDEX "external_deletions_state_next_attempt_at_idx" ON "external_deletions"("state", "next_attempt_at");

CREATE FUNCTION enqueue_external_deletion(p_provider TEXT, p_ref TEXT, p_reason TEXT) RETURNS VOID AS $$
BEGIN
  INSERT INTO "external_deletions" ("provider", "external_ref", "reason")
  VALUES (p_provider, p_ref, p_reason)
  ON CONFLICT ("provider", "external_ref") DO UPDATE
    SET "state" = 'pending', "attempts" = 0, "next_attempt_at" = CURRENT_TIMESTAMP,
        "not_before" = CURRENT_TIMESTAMP, "reason" = EXCLUDED."reason", "completed_at" = NULL
    WHERE "external_deletions"."state" IN ('cancelled', 'failed');
END;
$$ LANGUAGE plpgsql;

-- Les triggers couvrent toutes les cascades : compte, espace, athlète, exercice.
CREATE FUNCTION enqueue_mux_on_delete() RETURNS TRIGGER AS $$
BEGIN
  IF OLD."mux_asset_id" IS NOT NULL THEN
    PERFORM enqueue_external_deletion('mux_asset', OLD."mux_asset_id", TG_TABLE_NAME || '_deleted');
  ELSIF OLD."mux_upload_id" IS NOT NULL THEN
    PERFORM enqueue_external_deletion('mux_upload', OLD."mux_upload_id", TG_TABLE_NAME || '_deleted');
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "videos_enqueue_deletion" AFTER DELETE ON "videos"
  FOR EACH ROW EXECUTE FUNCTION enqueue_mux_on_delete();
CREATE TRIGGER "exercise_media_enqueue_deletion" AFTER DELETE ON "exercise_media"
  FOR EACH ROW EXECUTE FUNCTION enqueue_mux_on_delete();

CREATE FUNCTION is_tartan_blob(url TEXT) RETURNS BOOLEAN AS $$
  SELECT url ~ '^https://[a-z0-9-]+\.public\.blob\.vercel-storage\.com/';
$$ LANGUAGE sql IMMUTABLE;

CREATE FUNCTION enqueue_avatar_blob() RETURNS TRIGGER AS $$
BEGIN
  IF OLD."avatar_url" IS NOT NULL AND is_tartan_blob(OLD."avatar_url")
     AND (TG_OP = 'DELETE' OR NEW."avatar_url" IS DISTINCT FROM OLD."avatar_url") THEN
    PERFORM enqueue_external_deletion('blob', OLD."avatar_url", 'avatar_replaced');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "profiles_enqueue_avatar" AFTER DELETE OR UPDATE OF "avatar_url" ON "profiles"
  FOR EACH ROW EXECUTE FUNCTION enqueue_avatar_blob();

CREATE FUNCTION enqueue_logo_blob() RETURNS TRIGGER AS $$
BEGIN
  IF OLD."logo_url" IS NOT NULL AND is_tartan_blob(OLD."logo_url")
     AND (TG_OP = 'DELETE' OR NEW."logo_url" IS DISTINCT FROM OLD."logo_url") THEN
    PERFORM enqueue_external_deletion('blob', OLD."logo_url", 'logo_replaced');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "organizations_enqueue_logo" AFTER DELETE OR UPDATE OF "logo_url" ON "organizations"
  FOR EACH ROW EXECUTE FUNCTION enqueue_logo_blob();
