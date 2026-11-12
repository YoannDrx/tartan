-- Motif d'absence donné par l'athlète : liste fermée, sans donnée de santé. Colonne ajoutée, rien n'est retiré.
CREATE TYPE "absence_reason" AS ENUM ('work', 'studies', 'transport', 'family', 'other');

ALTER TABLE "attendance" ADD COLUMN "absence_reason" "absence_reason";
