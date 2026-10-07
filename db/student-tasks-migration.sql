-- Run this in the Neon SQL Editor before uploading the new application files.
-- Safe to rerun. Existing attendance records remain intact.
ALTER TABLE students ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS account_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_class_email ON students(class_id, email) WHERE email IS NOT NULL;
CREATE TABLE IF NOT EXISTS student_accounts (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 password_salt TEXT NOT NULL, password_hash TEXT NOT NULL,
 failed_at BIGINT NOT NULL DEFAULT 0, failed_count INTEGER NOT NULL DEFAULT 0,
 created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS student_sessions (
 token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES student_accounts(id) ON DELETE CASCADE,
 expires_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
 id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES classes(id),
 name TEXT NOT NULL, due_date TEXT NOT NULL, description TEXT,
 created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_class ON tasks(class_id, due_date DESC);
CREATE TABLE IF NOT EXISTS task_marks (
 task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
 student_id TEXT NOT NULL REFERENCES students(id),
 status TEXT NOT NULL CHECK (status IN ('submitted','missing')),
 updated_at BIGINT NOT NULL,
 PRIMARY KEY(task_id,student_id)
);
CREATE INDEX IF NOT EXISTS idx_students_account ON students(account_id);
