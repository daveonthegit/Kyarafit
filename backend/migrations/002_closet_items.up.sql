-- Closet items (device-scoped, no auth yet)
CREATE TABLE IF NOT EXISTS closet_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_closet_items_device_id ON closet_items (device_id);
CREATE INDEX IF NOT EXISTS idx_closet_items_updated_at ON closet_items (updated_at DESC);

DROP TRIGGER IF EXISTS closet_items_set_updated_at ON closet_items;
CREATE TRIGGER closet_items_set_updated_at BEFORE UPDATE ON closet_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
