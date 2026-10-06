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
