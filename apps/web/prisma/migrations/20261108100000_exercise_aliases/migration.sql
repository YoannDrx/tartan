-- Explicit coach-owned vocabulary. No historical matching or generated aliases.
ALTER TABLE exercises ADD COLUMN aliases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
