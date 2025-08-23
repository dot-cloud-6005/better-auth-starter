-- Create table for WebAuthn / Passkey credentials
CREATE TABLE IF NOT EXISTS drizzle.webauthn_credential (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES drizzle."user"(id) ON DELETE CASCADE,
    credential_id text NOT NULL UNIQUE,
    public_key text NOT NULL,
    counter integer DEFAULT 0 NOT NULL,
    transports text,
    device_type text,
    backed_up boolean,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    last_used_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_webauthn_user ON drizzle.webauthn_credential(user_id);
