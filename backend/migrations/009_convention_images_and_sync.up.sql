-- Add image support to conventions
ALTER TABLE conventions ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Ensure all tables have updated_at triggers for conflict resolution in sync
-- (Most tables already have this from previous migrations, but verify)

-- Update function to automatically set updated_at (idempotent)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure triggers exist on all sync-relevant tables
DO $$
BEGIN
    -- conventions
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_conventions_updated_at') THEN
        CREATE TRIGGER update_conventions_updated_at
            BEFORE UPDATE ON conventions
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- closet_items
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_closet_items_updated_at') THEN
        CREATE TRIGGER update_closet_items_updated_at
            BEFORE UPDATE ON closet_items
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- device_builds
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_device_builds_updated_at') THEN
        CREATE TRIGGER update_device_builds_updated_at
            BEFORE UPDATE ON device_builds
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- build_tasks
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_build_tasks_updated_at') THEN
        CREATE TRIGGER update_build_tasks_updated_at
            BEFORE UPDATE ON build_tasks
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- convention_day_plans
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_convention_day_plans_updated_at') THEN
        CREATE TRIGGER update_convention_day_plans_updated_at
            BEFORE UPDATE ON convention_day_plans
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- packing_list_items
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_packing_list_items_updated_at') THEN
        CREATE TRIGGER update_packing_list_items_updated_at
            BEFORE UPDATE ON packing_list_items
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;
