#!/bin/bash
# Migrate existing schema to Supabase
# Usage: ./scripts/migrate-to-supabase.sh postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres

if [ -z "$1" ]; then
  echo "Usage: $0 <supabase-connection-string>"
  exit 1
fi

DATABASE_URL=$1

echo "Running migrations on Supabase..."
cd backend

# Run all existing migrations
for file in migrations/*.up.sql; do
  echo "Running $file..."
  psql "$DATABASE_URL" -f "$file"
done

echo "✅ All migrations completed!"
