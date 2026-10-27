-- Database-level privacy. The API connects as the database owner, then runs
-- each user's queries inside a transaction as the restricted role app_user
-- (no RLS bypass) with app.user_id set (see lib/db/src/with-user.ts).
-- Row-level-security policies on personal tables compare user_id to
-- app_user_id(), so one user's request can never read or change another's rows.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;

-- Lets the API's connection role switch to app_user with SET LOCAL ROLE.
GRANT app_user TO postgres;
GRANT USAGE ON SCHEMA public TO app_user;

CREATE OR REPLACE FUNCTION public.app_user_id() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '') $$;
GRANT EXECUTE ON FUNCTION public.app_user_id() TO app_user;
