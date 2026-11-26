ALTER TABLE "beta_testers" ADD COLUMN "opened_at" TIMESTAMP(3), ADD COLUMN "apk_at" TIMESTAMP(3), ADD COLUMN "apple_at" TIMESTAMP(3);
CREATE TABLE "beta_apk_releases" (
  "build" INTEGER PRIMARY KEY,
  "version" TEXT NOT NULL,
  "digest" TEXT UNIQUE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "beta_installations" (
  "tester_id" UUID NOT NULL REFERENCES "beta_testers"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "installation_id" UUID NOT NULL,
  "platform" "device_platform" NOT NULL,
  "model" TEXT,
  "os" TEXT NOT NULL,
  "app_version" TEXT NOT NULL,
  "build" TEXT NOT NULL,
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("tester_id","installation_id")
);
