DROP INDEX IF EXISTS idx_conventions_user_id;
DROP INDEX IF EXISTS idx_device_builds_user_id;
DROP INDEX IF EXISTS idx_closet_items_user_id;

ALTER TABLE conventions DROP COLUMN IF EXISTS user_id;
ALTER TABLE device_builds DROP COLUMN IF EXISTS user_id;
ALTER TABLE closet_items DROP COLUMN IF EXISTS user_id;

DROP TRIGGER IF EXISTS subscriptions_set_updated_at ON subscriptions;
DROP INDEX IF EXISTS idx_subscriptions_user_id;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS app_users;
