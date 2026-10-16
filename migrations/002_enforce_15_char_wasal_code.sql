BEGIN;

-- الاحتفاظ برموز الحسابات القديمة ذات 15 خانة،
-- والسماح بالرموز الجديدة المكونة من خمسة أرقام.
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_wasal_code_format;

ALTER TABLE users
  ADD CONSTRAINT users_wasal_code_format
  CHECK (
    wasal_code ~ '^[0-9]{5}$'
    OR wasal_code ~ '^[A-Za-z0-9]{15}$'
  );

-- ضمان بقاء كل رمز فريدًا.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wasal_code_unique
  ON users (wasal_code);

COMMIT;
