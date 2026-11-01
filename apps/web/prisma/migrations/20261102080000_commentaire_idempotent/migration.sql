ALTER TABLE "comments" ADD COLUMN "client_id" TEXT;
CREATE UNIQUE INDEX "comments_client_id_key" ON "comments"("client_id");
