-- Migration: AI Problem Generation Feature
-- Run: psql -U postgres -d noteeverywhere -f migration_problems.sql

-- A generated problem set tied to a note
CREATE TABLE IF NOT EXISTS problem_sets (
  id SERIAL PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  created_by INTEGER NOT NULL REFERENCES users(id),
  title VARCHAR(500) NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'ai_summary', -- 'ai_summary' | 'free'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Individual problems in a set
CREATE TABLE IF NOT EXISTS problems (
  id SERIAL PRIMARY KEY,
  problem_set_id INTEGER NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('objective', 'subjective')),
  difficulty VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (difficulty IN ('easy', 'normal', 'hard')),
  question TEXT NOT NULL,
  correct_answer TEXT,      -- objective: 'A'/'B'/'C'/'D'; subjective: model answer
  explanation TEXT,         -- static feedback (objective only)
  position INTEGER NOT NULL
);

-- Choices for objective (MCQ) problems
CREATE TABLE IF NOT EXISTS problem_choices (
  id SERIAL PRIMARY KEY,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  label CHAR(1) NOT NULL,   -- 'A', 'B', 'C', 'D'
  text TEXT NOT NULL
);

-- A student's quiz session on a problem set
CREATE TABLE IF NOT EXISTS problem_set_sessions (
  id SERIAL PRIMARY KEY,
  problem_set_id INTEGER NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Each answer a student submits within a session
CREATE TABLE IF NOT EXISTS problem_attempts (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES problem_set_sessions(id) ON DELETE CASCADE,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  user_answer TEXT,
  ai_feedback TEXT,         -- subjective: dynamic AI suggestion; objective: copied from explanation
  is_correct BOOLEAN,       -- NULL for subjective
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_problem_sets_note      ON problem_sets(note_id);
CREATE INDEX IF NOT EXISTS idx_problems_set           ON problems(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_choices_problem        ON problem_choices(problem_id);
CREATE INDEX IF NOT EXISTS idx_sessions_set           ON problem_set_sessions(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user          ON problem_set_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_session       ON problem_attempts(session_id);
