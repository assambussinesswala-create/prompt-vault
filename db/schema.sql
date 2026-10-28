-- Prompt Vault PK database schema. Safe to run more than once.
-- Every saved record belongs to one user (user_id = the Clerk user id).

CREATE TABLE IF NOT EXISTS links (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS links_user_created_idx ON links (user_id, created_at DESC);

-- password_enc and notes_enc hold AES-256-GCM ciphertext only (never plaintext).
CREATE TABLE IF NOT EXISTS password_entries (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  site_name text NOT NULL,
  site_url text NOT NULL,
  username text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  password_enc text NOT NULL,
  notes_enc text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_entries_user_created_idx ON password_entries (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
