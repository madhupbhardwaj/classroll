CREATE TABLE IF NOT EXISTS teachers (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 password_salt TEXT NOT NULL, password_hash TEXT NOT NULL,
 failed_at BIGINT NOT NULL DEFAULT 0, failed_count INTEGER NOT NULL DEFAULT 0,
 created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS teacher_sessions (
 token_hash TEXT PRIMARY KEY, teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
 expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_teacher_sessions_expires ON teacher_sessions(expires_at);
CREATE TABLE IF NOT EXISTS invitations (
 email TEXT PRIMARY KEY, invited_by TEXT NOT NULL REFERENCES teachers(id),
 code_hash TEXT NOT NULL, created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS classes (
 id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL REFERENCES teachers(id), name TEXT NOT NULL,
 code TEXT NOT NULL UNIQUE, timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata', created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE TABLE IF NOT EXISTS students (
 id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES classes(id), name TEXT NOT NULL,
 roll TEXT NOT NULL, pin_salt TEXT NOT NULL, pin_hash TEXT NOT NULL,
 failed_at BIGINT NOT NULL DEFAULT 0, failed_count INTEGER NOT NULL DEFAULT 0,
 created_at BIGINT NOT NULL DEFAULT 0, UNIQUE(class_id, roll)
);
CREATE TABLE IF NOT EXISTS sessions (
 id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES classes(id), date TEXT NOT NULL,
 starts_at BIGINT NOT NULL, ends_at BIGINT NOT NULL, secret TEXT NOT NULL,
 closed_at BIGINT, UNIQUE(class_id, date)
);
CREATE TABLE IF NOT EXISTS attendance (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
 student_id TEXT NOT NULL REFERENCES students(id), status TEXT NOT NULL,
 method TEXT NOT NULL, checked_at BIGINT NOT NULL, note TEXT,
 UNIQUE(session_id, student_id)
);

-- Safe to run on an existing database. Archive timestamps preserve historical attendance.
ALTER TABLE classes ADD COLUMN IF NOT EXISTS archived_at BIGINT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS archived_at BIGINT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS account_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_class_email ON students(class_id, email) WHERE email IS NOT NULL;
CREATE TABLE IF NOT EXISTS student_accounts (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 google_sub TEXT NOT NULL UNIQUE,
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
