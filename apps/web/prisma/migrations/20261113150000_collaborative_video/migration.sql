-- Additive: existing clients retain all original columns and response fields.
ALTER TABLE "videos"
  ADD COLUMN "upload_client_id" TEXT,
  ADD COLUMN "upload_request_hash" TEXT,
  ADD COLUMN "upload_generation" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "quota_reserved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "shared_group_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "reviewed_by" UUID;
-- Existing reservations keep their original month, rather than counting again today.
UPDATE "videos" SET "quota_reserved_at" = "created_at";
CREATE UNIQUE INDEX "videos_organization_id_uploaded_by_upload_client_id_key"
  ON "videos" ("organization_id", "uploaded_by", "upload_client_id");
ALTER TABLE "exercise_media" ADD COLUMN "quota_reserved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "exercise_media" SET "quota_reserved_at" = "created_at";
ALTER TABLE "video_annotations" ADD COLUMN "parent_id" UUID;
ALTER TABLE "video_annotations" ADD CONSTRAINT "video_annotations_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "video_annotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
