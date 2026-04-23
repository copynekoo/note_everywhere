-- Migration 002: note views tracking + resumable sessions

-- Track note views
CREATE TABLE IF NOT EXISTS note_views (
  id SERIAL PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_note_views_note ON note_views(note_id);
CREATE INDEX IF NOT EXISTS idx_note_views_user ON note_views(user_id);

-- Resumable sessions: track which question the user is on
ALTER TABLE problem_set_sessions
  ADD COLUMN IF NOT EXISTS current_question_idx INTEGER DEFAULT 0;
