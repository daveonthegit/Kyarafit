-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email CITEXT UNIQUE NOT NULL,
  username VARCHAR(50),
  display_name VARCHAR(100),
  avatar_url TEXT,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pieces (closet items)
CREATE TABLE IF NOT EXISTS pieces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(60),               -- e.g., wig, prop, top, bottom, accessory
  color VARCHAR(40),
  brand VARCHAR(80),
  size VARCHAR(40),
  notes TEXT,
  image_url TEXT,                     -- CDN URL (Cloudflare Images)
  image_bg_removed_url TEXT,          -- Processed PNG with transparent bg
  cost_cents INTEGER,                 -- optional cost tracking
  acquired_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Builds (a cosplay build or character project)
CREATE TABLE IF NOT EXISTS builds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(120) NOT NULL,
  character VARCHAR(120),
  series VARCHAR(120),
  status VARCHAR(24) NOT NULL DEFAULT 'idea', -- idea | sourcing | wip | complete
  target_event VARCHAR(160),
  budget_cents INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Join table mapping pieces to builds
CREATE TABLE IF NOT EXISTS build_pieces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  build_id UUID NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  piece_id UUID NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  role VARCHAR(80),                    -- e.g., wig, top, bottom, prop, accessory
  quantity INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (build_id, piece_id)
);

-- Wear logs (when a piece/build was worn/used)
CREATE TABLE IF NOT EXISTS wear_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  piece_id UUID REFERENCES pieces(id) ON DELETE SET NULL,
  build_id UUID REFERENCES builds(id) ON DELETE SET NULL,
  worn_on DATE NOT NULL,
  location VARCHAR(160),
  event_name VARCHAR(160),
  duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Triggers to update updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER pieces_set_updated_at BEFORE UPDATE ON pieces
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER builds_set_updated_at BEFORE UPDATE ON builds
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER build_pieces_set_updated_at BEFORE UPDATE ON build_pieces
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER wear_logs_set_updated_at BEFORE UPDATE ON wear_logs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_pieces_user ON pieces (user_id);
CREATE INDEX IF NOT EXISTS idx_builds_user ON builds (user_id);
CREATE INDEX IF NOT EXISTS idx_build_pieces_build ON build_pieces (build_id);
CREATE INDEX IF NOT EXISTS idx_build_pieces_piece ON build_pieces (piece_id);
CREATE INDEX IF NOT EXISTS idx_wear_logs_user_date ON wear_logs (user_id, worn_on);
