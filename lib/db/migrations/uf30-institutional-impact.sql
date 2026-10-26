-- Additive UF30-only tables. Do not connect this report data to AFTA assessments or chat.
-- Invitation secrets and participant tokens are stored only as SHA-256 hashes.
CREATE TABLE IF NOT EXISTS uf30_institutions (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name_arabic text NOT NULL,
  name_english text NOT NULL,
  invitation_code_hash text NOT NULL,
  discount_percent integer NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS uf30_institution_members (
  id text PRIMARY KEY,
  institution_id text NOT NULL REFERENCES uf30_institutions(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uf30_institution_member_unique UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS uf30_institution_member_user_idx ON uf30_institution_members(user_id);

CREATE TABLE IF NOT EXISTS uf30_participants (
  id text PRIMARY KEY,
  institution_id text NOT NULL REFERENCES uf30_institutions(id) ON DELETE CASCADE,
  participant_token_hash text NOT NULL UNIQUE,
  enrolled_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS uf30_participant_institution_idx ON uf30_participants(institution_id);

CREATE TABLE IF NOT EXISTS uf30_impact_measurements (
  id text PRIMARY KEY,
  participant_id text NOT NULL REFERENCES uf30_participants(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN ('baseline', 'after_session_four', 'after_two_months')),
  on_time_completion real NOT NULL CHECK (on_time_completion BETWEEN 0 AND 100),
  punctuality real NOT NULL CHECK (punctuality BETWEEN 0 AND 100),
  manager_rating real NOT NULL CHECK (manager_rating BETWEEN 1 AND 5),
  participant_satisfaction real NOT NULL CHECK (participant_satisfaction BETWEEN 1 AND 5),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uf30_impact_participant_phase_unique UNIQUE (participant_id, phase)
);
CREATE INDEX IF NOT EXISTS uf30_impact_phase_idx ON uf30_impact_measurements(phase);
