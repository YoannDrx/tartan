-- Lien d'agenda révocable : ajout seul, les liens existants restent valides.
ALTER TABLE "athletes" ADD COLUMN "ical_version" INTEGER NOT NULL DEFAULT 0;
