-- Remove target_date from device_builds
ALTER TABLE device_builds DROP COLUMN IF EXISTS target_date;
