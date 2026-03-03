DROP TRIGGER IF EXISTS wear_logs_set_updated_at ON wear_logs;
DROP TRIGGER IF EXISTS build_pieces_set_updated_at ON build_pieces;
DROP TRIGGER IF EXISTS builds_set_updated_at ON builds;
DROP TRIGGER IF EXISTS pieces_set_updated_at ON pieces;
DROP TRIGGER IF EXISTS users_set_updated_at ON users;

DROP FUNCTION IF EXISTS set_updated_at;

DROP TABLE IF EXISTS wear_logs;
DROP TABLE IF EXISTS build_pieces;
DROP TABLE IF EXISTS builds;
DROP TABLE IF EXISTS pieces;
DROP TABLE IF EXISTS users;

-- Do not drop extensions by default
