-- Durées de conservation : ajout seul. Sans date d'activité, le compte compte comme actif depuis sa création.
ALTER TABLE "profiles" ADD COLUMN "last_active_at" TIMESTAMP(3);
ALTER TABLE "profiles" ADD COLUMN "inactivity_notice_at" TIMESTAMP(3);
