-- NoteEverywhere Database Schema
-- Run: psql -U postgres -f init.sql

CREATE DATABASE noteeverywhere;
\c noteeverywhere;

-- Faculties
CREATE TABLE faculties (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Majors
CREATE TABLE majors (
  id SERIAL PRIMARY KEY,
  faculty_id INTEGER NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(faculty_id, name)
);

-- Subjects
-- year_level = A.D. curriculum year the subject belongs to (e.g. 2025)
CREATE TABLE subjects (
  id SERIAL PRIMARY KEY,
  major_id INTEGER NOT NULL REFERENCES majors(id) ON DELETE CASCADE,
  code VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  year_level INTEGER DEFAULT 2025,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  student_id VARCHAR(10) NOT NULL UNIQUE,
  faculty_id INTEGER REFERENCES faculties(id),
  major_id INTEGER REFERENCES majors(id),
  year INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Notes
CREATE TABLE notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  file_path VARCHAR(1000),
  file_type VARCHAR(50),
  external_link VARCHAR(1000),
  is_public BOOLEAN DEFAULT TRUE,
  ai_summary TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Ratings
CREATE TABLE ratings (
  id SERIAL PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value INTEGER NOT NULL CHECK (value IN (1, -1)),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(note_id, user_id)
);

-- Comments
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Follows (user follows a subject)
CREATE TABLE follows (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, subject_id)
);

-- Notifications
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  reference_id INTEGER,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_notes_subject ON notes(subject_id);
CREATE INDEX idx_notes_user ON notes(user_id);
CREATE INDEX idx_ratings_note ON ratings(note_id);
CREATE INDEX idx_comments_note ON comments(note_id);
CREATE INDEX idx_follows_user ON follows(user_id);
CREATE INDEX idx_follows_subject ON follows(subject_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_majors_faculty ON majors(faculty_id);
CREATE INDEX idx_subjects_major ON subjects(major_id);

-- Seed data: Kasetsart University Faculties & Majors
INSERT INTO faculties (name) VALUES
  ('Faculty of Engineering'),
  ('Faculty of Science'),
  ('Faculty of Agriculture'),
  ('Faculty of Business Administration'),
  ('Faculty of Economics'),
  ('Faculty of Humanities'),
  ('Faculty of Social Sciences'),
  ('Faculty of Veterinary Medicine'),
  ('Faculty of Education'),
  ('Faculty of Architecture');

-- Engineering Majors
INSERT INTO majors (faculty_id, name) VALUES
  (1, 'Computer Engineering'),
  (1, 'Electrical Engineering'),
  (1, 'Mechanical Engineering'),
  (1, 'Civil Engineering'),
  (1, 'Chemical Engineering'),
  (1, 'Industrial Engineering'),
  (1, 'Software and Knowledge Engineering');

-- Science Majors
INSERT INTO majors (faculty_id, name) VALUES
  (2, 'Computer Science'),
  (2, 'Mathematics'),
  (2, 'Physics'),
  (2, 'Chemistry'),
  (2, 'Biology'),
  (2, 'Statistics');

-- Agriculture Majors
INSERT INTO majors (faculty_id, name) VALUES
  (3, 'Agronomy'),
  (3, 'Horticulture'),
  (3, 'Animal Science');

-- Business Administration Majors
INSERT INTO majors (faculty_id, name) VALUES
  (4, 'Marketing'),
  (4, 'Finance'),
  (4, 'Management'),
  (4, 'Accounting');

-- Sample subjects for Computer Engineering
INSERT INTO subjects (major_id, code, name, year_level) VALUES
  (1, '01204111', 'Computers and Programming', 2025),
  (1, '01204211', 'Discrete Mathematics', 2026),
  (1, '01204212', 'Data Structures', 2026),
  (1, '01204223', 'Digital Computer Logic', 2026),
  (1, '01204311', 'Algorithm Design and Analysis', 2027),
  (1, '01204332', 'Database Systems', 2027),
  (1, '01204341', 'Operating Systems', 2027);

-- Sample subjects for Computer Science
INSERT INTO subjects (major_id, code, name, year_level) VALUES
  (8, '01418111', 'Introduction to Computer Science', 2025),
  (8, '01418211', 'Software Construction', 2026),
  (8, '01418231', 'Data Structures and Algorithms', 2026),
  (8, '01418321', 'System Analysis and Design', 2027),
  (8, '01418331', 'Database Management Systems', 2027);

-- Sample subjects for Mathematics
INSERT INTO subjects (major_id, code, name, year_level) VALUES
  (9, '01417111', 'Calculus I', 2025),
  (9, '01417112', 'Calculus II', 2025),
  (9, '01417211', 'Linear Algebra', 2026);

-- Sample subjects for Electrical Engineering
INSERT INTO subjects (major_id, code, name, year_level) VALUES
  (2, '01205211', 'Circuit Analysis', 2026),
  (2, '01205212', 'Electronics I', 2026),
  (2, '01205311', 'Signal and Systems', 2027);
