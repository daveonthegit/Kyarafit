-- App users: tier and storage usage (id matches auth provider subject, e.g. BetterAuth user id)
CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  tier TEXT NOT NULL DEFAULT 'FREE' CHECK (tier IN ('ANON', 'FREE', 'PREMIUM_BASIC', 'PREMIUM_PRO')),
  current_usage_mb INTEGER NOT NULL DEFAULT 0
);

-- Subscriptions: Stripe price_id -> tier, storage quota
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  stripe_price_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('PREMIUM_BASIC', 'PREMIUM_PRO')),
  storage_quota_mb INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions (user_id);
DROP TRIGGER IF EXISTS subscriptions_set_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Attribute device data to user when authenticated (nullable for anonymous)
ALTER TABLE closet_items ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE device_builds ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE conventions ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_closet_items_user_id ON closet_items (user_id);
CREATE INDEX IF NOT EXISTS idx_device_builds_user_id ON device_builds (user_id);
CREATE INDEX IF NOT EXISTS idx_conventions_user_id ON conventions (user_id);
