-- Run once in the Neon SQL Editor before deploying the Google sign-in update.
-- This deletes ONLY test student accounts and sessions, leaving teacher accounts,
-- roster entries, class tasks, submission marks and attendance history untouched.
BEGIN;
UPDATE students SET account_id = NULL WHERE account_id IS NOT NULL;
DELETE FROM student_sessions;
DELETE FROM student_accounts;
ALTER TABLE student_accounts DROP COLUMN IF EXISTS password_salt;
ALTER TABLE student_accounts DROP COLUMN IF EXISTS password_hash;
ALTER TABLE student_accounts DROP COLUMN IF EXISTS failed_at;
ALTER TABLE student_accounts DROP COLUMN IF EXISTS failed_count;
ALTER TABLE student_accounts ADD COLUMN IF NOT EXISTS google_sub TEXT;
ALTER TABLE student_accounts ALTER COLUMN google_sub SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_accounts_google_sub ON student_accounts(google_sub);
COMMIT;
