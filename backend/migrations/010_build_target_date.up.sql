-- Add target_date (deadline) to device_builds
ALTER TABLE device_builds ADD COLUMN IF NOT EXISTS target_date DATE;
