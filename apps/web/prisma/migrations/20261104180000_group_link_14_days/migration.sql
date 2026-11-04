-- Un lien de groupe partagé ne reste plus valable des mois : 14 jours au plus à partir d'aujourd'hui.
UPDATE "invitations"
SET "expires_at" = LEAST("expires_at", now() + interval '14 days')
WHERE "kind" IN ('group_link', 'qr') AND "status" <> 'revoked';
