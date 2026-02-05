-- Remove image support from conventions
ALTER TABLE conventions DROP COLUMN IF EXISTS image_url;

-- Note: We keep the updated_at triggers as they don't harm and may be used by other features
