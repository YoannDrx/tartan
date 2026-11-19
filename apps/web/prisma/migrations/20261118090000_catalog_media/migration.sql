-- La vidéo d'une fiche commune du catalogue : une table nouvelle, rien n'est retiré.
CREATE TABLE "catalog_media" (
    "id" UUID NOT NULL,
    "catalog_key" TEXT NOT NULL,
    "view" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'uploading',
    "mux_upload_id" TEXT,
    "mux_asset_id" TEXT,
    "mux_playback_id" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_media_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "catalog_media_catalog_key_view_idx" ON "catalog_media"("catalog_key", "view");
