-- Phases génériques pour les vidéos qui ne sont pas des sauts : ajout de valeurs, rien n'est retiré.
ALTER TYPE "jump_phase" ADD VALUE IF NOT EXISTS 'preparation';
ALTER TYPE "jump_phase" ADD VALUE IF NOT EXISTS 'execution';
ALTER TYPE "jump_phase" ADD VALUE IF NOT EXISTS 'finish';
