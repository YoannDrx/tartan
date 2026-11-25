ALTER TABLE "profiles"
  ADD COLUMN "home_tone" TEXT NOT NULL DEFAULT 'calm' CHECK ("home_tone" IN ('calm','energetic','off')),
  ADD COLUMN "session_tone" TEXT NOT NULL DEFAULT 'calm' CHECK ("session_tone" IN ('calm','energetic','off'));
