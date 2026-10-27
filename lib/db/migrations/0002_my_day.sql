-- My Day: per-user settings, planned items, daily logs and summaries, beliefs and files.
-- Every table is personal: RLS on, one owner policy for app_user (see 0001).

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
  LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id text PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
  time_zone text NOT NULL DEFAULT 'Asia/Riyadh',
  city_name text,
  latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  prayer_method text NOT NULL DEFAULT 'umm_al_qura'
    CHECK (prayer_method IN ('umm_al_qura', 'mwl', 'egyptian', 'karachi', 'dubai')),
  prayer_adjustments jsonb NOT NULL DEFAULT '{}'::jsonb,
  count_prayers boolean NOT NULL DEFAULT true,
  day_start text NOT NULL DEFAULT 'midnight' CHECK (day_start IN ('midnight', 'fajr')),
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  font_scale real NOT NULL DEFAULT 1 CHECK (font_scale BETWEEN 0.85 AND 1.4),
  belief_frequency text NOT NULL DEFAULT 'off' CHECK (belief_frequency IN ('off', '1h', '2h')),
  quiet_start text NOT NULL DEFAULT '22:00',
  quiet_end text NOT NULL DEFAULT '07:00',
  setup_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS files (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  storage_key text NOT NULL UNIQUE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS files_owner_idx ON files (user_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS items (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  type text NOT NULL DEFAULT 'task'
    CHECK (type IN ('task', 'exercise', 'meditation', 'reading', 'habit', 'reminder')),
  timing jsonb NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 25 CHECK (duration_minutes BETWEEN 1 AND 600),
  recurrence jsonb NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  hidden boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'program', 'ai', 'planner')),
  attachment_file_id text REFERENCES files(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS items_owner_idx ON items (user_id) WHERE deleted_at IS NULL;

-- Latest status of one timeline entry (an item id or 'prayer:<name>') on one day.
-- 'pending' records an undo, so changes stay visible to other devices.
CREATE TABLE IF NOT EXISTS item_logs (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  day date NOT NULL,
  entry_key text NOT NULL CHECK (char_length(entry_key) BETWEEN 1 AND 100),
  status text NOT NULL CHECK (status IN ('pending', 'done', 'snoozed', 'skipped')),
  snoozed_until integer CHECK (snoozed_until BETWEEN 0 AND 2880),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day, entry_key)
);

-- One row per day, written whenever that day's logs change; past days are never reset.
CREATE TABLE IF NOT EXISTS day_summaries (
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  day date NOT NULL,
  planned integer NOT NULL CHECK (planned >= 0),
  done integer NOT NULL CHECK (done >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS beliefs (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 300),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS beliefs_owner_idx ON beliefs (user_id) WHERE deleted_at IS NULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_settings', 'files', 'items', 'item_logs', 'day_summaries', 'beliefs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS owner_only ON %I', t);
    EXECUTE format(
      'CREATE POLICY owner_only ON %I FOR ALL TO app_user USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id())',
      t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_user', t);
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END
$$;
