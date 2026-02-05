-- Fix dirty migration state
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/yjmkaxvnnocoejdjneyw/sql

-- Check current migration state
SELECT * FROM schema_migrations;

-- Fix the dirty flag (set dirty=false for version 1)
UPDATE schema_migrations SET dirty = false WHERE version = 1;

-- Verify it's fixed
SELECT * FROM schema_migrations;
