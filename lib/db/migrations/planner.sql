-- Additive only. Never modifies AFTA assessment, reflection, or chat tables.
CREATE TABLE IF NOT EXISTS planner_tasks (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id),
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'task',
  status text NOT NULL DEFAULT 'pending',
  scheduled_day date NOT NULL,
  reminder_time text,
  completed_day date,
  deferred_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS planner_tasks_owner_day_idx ON planner_tasks(user_id, scheduled_day);
CREATE TABLE IF NOT EXISTS planner_ideas (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id),
  text text NOT NULL,
  suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS planner_ideas_owner_idx ON planner_ideas(user_id);
