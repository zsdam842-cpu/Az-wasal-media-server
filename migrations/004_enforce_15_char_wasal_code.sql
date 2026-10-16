
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM users
    WHERE wasal_code IS NULL
       OR wasal_code !~ '^[A-Za-z0-9]{15}$'
  ) THEN
    RAISE EXCEPTION
      'Migration 004 failed: all Wasal codes must contain exactly 15 English letters or digits.';
  END IF;
END $$;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_wasal_code_format;

ALTER TABLE users
  ADD CONSTRAINT users_wasal_code_format
  CHECK (wasal_code ~ '^[A-Za-z0-9]{15}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wasal_code_unique
  ON users (wasal_code);
