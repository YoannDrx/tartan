ALTER TABLE organizations ADD COLUMN billing_owner_id UUID, ADD COLUMN billing_issue TEXT;
UPDATE organizations SET billing_owner_id = owner_id WHERE stripe_customer_id IS NOT NULL;
ALTER TABLE email_outbox ADD COLUMN failed_at TIMESTAMP(3), ADD COLUMN failure_code TEXT, ADD COLUMN retry_until TIMESTAMP(3);

CREATE TABLE checkout_intents (
 id UUID PRIMARY KEY, organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
 generation INTEGER NOT NULL DEFAULT 1, plan TEXT NOT NULL, interval TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'creating', session_id TEXT, url TEXT, request JSONB,
 attempted_at TIMESTAMP(3), expires_at TIMESTAMP(3), lease_token TEXT, lease_until TIMESTAMP(3),
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL,
 CHECK (state IN ('creating', 'open', 'expired', 'completed', 'review'))
);
CREATE TABLE billing_commands (
 id UUID PRIMARY KEY, organization_id UUID NOT NULL, kind TEXT NOT NULL, external_ref TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, lease_token TEXT, lease_until TIMESTAMP(3),
 last_error_code TEXT, completed_at TIMESTAMP(3), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE (kind, external_ref), CHECK (kind IN ('cancel_at_period_end', 'close_customer_checkout')),
 CHECK (state IN ('pending', 'done'))
);
CREATE INDEX billing_commands_state_next_attempt_at_idx ON billing_commands(state, next_attempt_at);
