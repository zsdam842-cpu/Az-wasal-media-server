
-- Migration 003: allow legacy 5-digit codes and new 15-character codes.
-- The migration runner manages the transaction.

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_wasal_code_format;

ALTER TABLE users
  ADD CONSTRAINT users_wasal_code_format
  CHECK (
    wasal_code ~ '^[0-9]{5}$'
    OR wasal_code ~ '^[A-Za-z0-9]{15}$'
  );

-- Stop safely if duplicate codes exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM users
    GROUP BY wasal_code
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate wasal_code values exist. Resolve duplicates before applying migration 003.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wasal_code_unique
  ON users (wasal_code);
