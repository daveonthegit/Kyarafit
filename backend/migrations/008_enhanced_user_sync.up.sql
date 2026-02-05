-- Enhanced user sync: add email, metadata, and subscription tracking
-- Extends app_users table with more complete user information

-- Add email and metadata columns to app_users
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN DEFAULT FALSE;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add subscription tracking fields
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS subscription_status TEXT; -- active, canceled, past_due, trialing, etc.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users (email);
CREATE INDEX IF NOT EXISTS idx_app_users_stripe_customer_id ON app_users (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_app_users_stripe_subscription_id ON app_users (stripe_subscription_id);

DO $$
BEGIN
  -- Check if auth schema exists (Supabase only)
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    -- Enhanced function to sync more user info from auth.users
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $func$
    BEGIN
      INSERT INTO public.app_users (
        id, 
        email, 
        email_confirmed,
        tier, 
        current_usage_mb,
        created_at,
        last_sign_in_at,
        metadata
      )
      VALUES (
        NEW.id, 
        NEW.email,
        NEW.email_confirmed_at IS NOT NULL,
        'FREE', 
        0,
        NEW.created_at,
        NEW.last_sign_in_at,
        COALESCE(NEW.raw_user_meta_data, '{}'::jsonb)
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        email_confirmed = EXCLUDED.email_confirmed,
        last_sign_in_at = EXCLUDED.last_sign_in_at,
        metadata = EXCLUDED.metadata;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Update trigger to fire on INSERT and UPDATE
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT OR UPDATE ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

    -- Sync existing users (update email and metadata for existing records)
    INSERT INTO public.app_users (
      id, 
      email, 
      email_confirmed,
      tier, 
      current_usage_mb,
      created_at,
      last_sign_in_at,
      metadata
    )
    SELECT 
      id, 
      email,
      email_confirmed_at IS NOT NULL,
      'FREE', 
      0,
      created_at,
      last_sign_in_at,
      COALESCE(raw_user_meta_data, '{}'::jsonb)
    FROM auth.users
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      email_confirmed = EXCLUDED.email_confirmed,
      created_at = EXCLUDED.created_at,
      last_sign_in_at = EXCLUDED.last_sign_in_at,
      metadata = EXCLUDED.metadata;

    RAISE NOTICE 'Enhanced user sync configured successfully';
  ELSE
    RAISE NOTICE 'Skipping enhanced user sync (auth schema not found - using local postgres)';
  END IF;
END $$;
