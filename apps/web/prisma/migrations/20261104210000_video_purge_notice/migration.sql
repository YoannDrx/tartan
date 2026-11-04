-- Préavis de purge par vidéo : ajout seul. Aucune vidéo n'a de préavis, donc aucune n'est supprimable avant un envoi réussi.
ALTER TABLE "videos" ADD COLUMN "purge_notice_at" TIMESTAMP(3);
CREATE INDEX "videos_organization_id_created_at_idx" ON "videos"("organization_id", "created_at");
