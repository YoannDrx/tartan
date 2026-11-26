CREATE TABLE "exercise_filming" (
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "exercise_id" UUID NOT NULL REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "filmed" BOOLEAN NOT NULL DEFAULT false,
  "comment" VARCHAR(2000) NOT NULL DEFAULT '',
  "revision" INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY ("organization_id", "exercise_id")
);
CREATE INDEX "exercise_filming_exercise_id_idx" ON "exercise_filming" ("exercise_id");
