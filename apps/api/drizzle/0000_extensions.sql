-- Custom SQL migration file, put your code below! --

CREATE EXTENSION IF NOT EXISTS pg_trgm;

--> statement-breakpoint

DO $$
BEGIN
  -- Re-runnable on purpose: a deploy that dies between this statement and the
  -- migrator's journal row leaves the database half migrated, and the next
  -- container has to be able to apply the file again. CREATE COLLATION IF NOT
  -- EXISTS would do that too on PG 16, but it resolves against search_path,
  -- while pg_collation is what first-deploy.md and the tests actually read.
  IF NOT EXISTS (SELECT 1 FROM pg_collation WHERE collname = 'fa') THEN
    CREATE COLLATION fa (provider = icu, locale = 'fa');
  END IF;
END
$$;
