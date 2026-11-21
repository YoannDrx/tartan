-- Listes d'exercices du coach et leurs fiches : deux tables ajoutées, rien n'est retiré.
-- CreateTable
CREATE TABLE "exercise_lists" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_favorites" BOOLEAN NOT NULL DEFAULT false,
    "shared_with_coaches" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_list_items" (
    "list_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_list_items_pkey" PRIMARY KEY ("list_id","exercise_id")
);

-- CreateIndex
CREATE INDEX "exercise_lists_organization_id_owner_id_idx" ON "exercise_lists"("organization_id", "owner_id");

-- CreateIndex
CREATE INDEX "exercise_list_items_exercise_id_idx" ON "exercise_list_items"("exercise_id");

-- AddForeignKey
ALTER TABLE "exercise_lists" ADD CONSTRAINT "exercise_lists_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_lists" ADD CONSTRAINT "exercise_lists_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_list_items" ADD CONSTRAINT "exercise_list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "exercise_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_list_items" ADD CONSTRAINT "exercise_list_items_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

