CREATE TABLE email_suppressions (
 email_hash TEXT PRIMARY KEY,
 reason TEXT NOT NULL CHECK (reason IN ('bounce', 'complaint', 'suppressed')),
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
