DROP TRIGGER IF EXISTS build_tasks_set_updated_at ON build_tasks;
DROP TABLE IF EXISTS build_tasks;

ALTER TABLE device_builds DROP COLUMN IF EXISTS image_url;
ALTER TABLE device_builds DROP COLUMN IF EXISTS budget_cents;

ALTER TABLE closet_items DROP COLUMN IF EXISTS cost_cents;
