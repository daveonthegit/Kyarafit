-- Closet items: cost (store in cents)
ALTER TABLE closet_items ADD COLUMN IF NOT EXISTS cost_cents INTEGER;

-- Builds: character image and budget
ALTER TABLE device_builds ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE device_builds ADD COLUMN IF NOT EXISTS budget_cents INTEGER;

-- Build tasks: checklist items that can link to a closet item
CREATE TABLE IF NOT EXISTS build_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  build_id UUID NOT NULL REFERENCES device_builds(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  closet_item_id UUID REFERENCES closet_items(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_build_tasks_build_id ON build_tasks (build_id);
DROP TRIGGER IF EXISTS build_tasks_set_updated_at ON build_tasks;
CREATE TRIGGER build_tasks_set_updated_at BEFORE UPDATE ON build_tasks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
