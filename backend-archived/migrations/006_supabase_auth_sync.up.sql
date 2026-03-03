-- Sync Supabase auth.users to app_users for tier management
-- NOTE: This migration only runs on Supabase PostgreSQL (skips local dev postgres)

DO $$
BEGIN
  -- Check if auth schema exists (Supabase only)
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    -- Function to create app_users entry when auth user is created
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $func$
    BEGIN
      INSERT INTO public.app_users (id, tier, current_usage_mb)
      VALUES (NEW.id, 'FREE', 0)
      ON CONFLICT (id) DO NOTHING;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Drop trigger if it exists (for re-running migration)
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

    -- Trigger fires after new user signs up
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

    -- Sync existing users (if any)
    INSERT INTO public.app_users (id, tier, current_usage_mb)
    SELECT id, 'FREE', 0
    FROM auth.users
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Supabase auth sync configured successfully';
  ELSE
    RAISE NOTICE 'Skipping Supabase auth sync (auth schema not found - using local postgres)';
  END IF;
END $$;
