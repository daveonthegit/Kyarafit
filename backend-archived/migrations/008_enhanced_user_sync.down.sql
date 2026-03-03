-- Rollback enhanced user sync

-- Remove indexes
DROP INDEX IF EXISTS idx_app_users_email;
DROP INDEX IF EXISTS idx_app_users_stripe_customer_id;
DROP INDEX IF EXISTS idx_app_users_stripe_subscription_id;

-- Remove columns (in reverse order of dependencies)
ALTER TABLE app_users DROP COLUMN IF EXISTS subscription_current_period_end;
ALTER TABLE app_users DROP COLUMN IF EXISTS subscription_status;
ALTER TABLE app_users DROP COLUMN IF EXISTS stripe_subscription_id;
ALTER TABLE app_users DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE app_users DROP COLUMN IF EXISTS metadata;
ALTER TABLE app_users DROP COLUMN IF EXISTS last_sign_in_at;
ALTER TABLE app_users DROP COLUMN IF EXISTS created_at;
ALTER TABLE app_users DROP COLUMN IF EXISTS email_confirmed;
ALTER TABLE app_users DROP COLUMN IF EXISTS email;

-- Revert to original trigger (basic sync only)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $func$
    BEGIN
      INSERT INTO public.app_users (id, tier, current_usage_mb)
      VALUES (NEW.id, 'FREE', 0)
      ON CONFLICT (id) DO NOTHING;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;
