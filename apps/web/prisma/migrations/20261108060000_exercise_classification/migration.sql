-- Unknown historical classification stays NULL. No backfill by exercise name.
ALTER TABLE exercises ADD COLUMN classification JSONB;
