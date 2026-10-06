-- Run once in the Neon SQL Editor before deploying the updated app. Safe to rerun.
ALTER TABLE classes ADD COLUMN IF NOT EXISTS archived_at BIGINT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS archived_at BIGINT;
