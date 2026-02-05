-- Device-scoped builds (cosplay builds for convention slice)
CREATE TABLE IF NOT EXISTS device_builds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  character TEXT,
  status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'wip', 'ready')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_builds_device_id ON device_builds (device_id);
DROP TRIGGER IF EXISTS device_builds_set_updated_at ON device_builds;
CREATE TRIGGER device_builds_set_updated_at BEFORE UPDATE ON device_builds
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Join: build <-> closet_items
CREATE TABLE IF NOT EXISTS build_item_links (
  build_id UUID NOT NULL REFERENCES device_builds(id) ON DELETE CASCADE,
  closet_item_id UUID NOT NULL REFERENCES closet_items(id) ON DELETE CASCADE,
  PRIMARY KEY (build_id, closet_item_id)
);

CREATE INDEX IF NOT EXISTS idx_build_item_links_build ON build_item_links (build_id);
CREATE INDEX IF NOT EXISTS idx_build_item_links_closet ON build_item_links (closet_item_id);

-- Conventions
CREATE TABLE IF NOT EXISTS conventions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conventions_device_id ON conventions (device_id);
DROP TRIGGER IF EXISTS conventions_set_updated_at ON conventions;
CREATE TRIGGER conventions_set_updated_at BEFORE UPDATE ON conventions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Day plan: one row per (convention, date); build_id nullable for rest day
CREATE TABLE IF NOT EXISTS convention_day_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  convention_id UUID NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  build_id UUID REFERENCES device_builds(id) ON DELETE SET NULL,
  notes TEXT,
  UNIQUE (convention_id, date)
);

CREATE INDEX IF NOT EXISTS idx_convention_day_plans_convention ON convention_day_plans (convention_id);

-- Packing list items (auto-derived + manual; checked persists)
CREATE TABLE IF NOT EXISTS packing_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  convention_id UUID NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
  date DATE,
  build_id UUID REFERENCES device_builds(id) ON DELETE SET NULL,
  closet_item_id UUID REFERENCES closet_items(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_packing_list_items_convention ON packing_list_items (convention_id);
DROP TRIGGER IF EXISTS packing_list_items_set_updated_at ON packing_list_items;
CREATE TRIGGER packing_list_items_set_updated_at BEFORE UPDATE ON packing_list_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
