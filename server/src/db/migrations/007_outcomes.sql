-- 007_outcomes: OBE co-curricular transcript mapped to BAETE program outcomes PO1 to PO12.
CREATE TABLE IF NOT EXISTS program_outcomes (
  id TEXT PRIMARY KEY,
  framework TEXT NOT NULL DEFAULT 'BAETE',
  code TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_bn TEXT NOT NULL,
  description TEXT NOT NULL,
  UNIQUE (framework, code)
);

INSERT INTO program_outcomes (id, framework, code, title_en, title_bn, description) VALUES
  ('baete-po1', 'BAETE', 'PO1', 'Engineering knowledge', 'প্রকৌশল জ্ঞান', 'Apply knowledge of mathematics, natural science, engineering fundamentals and an engineering specialisation to the solution of complex engineering problems.'),
  ('baete-po2', 'BAETE', 'PO2', 'Problem analysis', 'সমস্যা বিশ্লেষণ', 'Identify, formulate, research literature and analyse complex engineering problems reaching substantiated conclusions.'),
  ('baete-po3', 'BAETE', 'PO3', 'Design/development of solutions', 'সমাধানের নকশা ও উন্নয়ন', 'Design solutions for complex engineering problems and design systems, components or processes that meet specified needs.'),
  ('baete-po4', 'BAETE', 'PO4', 'Investigation', 'অনুসন্ধান', 'Conduct investigations of complex problems using research-based knowledge and methods, including design of experiments, analysis and interpretation of data.'),
  ('baete-po5', 'BAETE', 'PO5', 'Modern tool usage', 'আধুনিক সরঞ্জামের ব্যবহার', 'Create, select and apply appropriate techniques, resources and modern engineering and IT tools, with an understanding of their limitations.'),
  ('baete-po6', 'BAETE', 'PO6', 'The engineer and society', 'প্রকৌশলী ও সমাজ', 'Apply reasoning informed by contextual knowledge to assess societal, health, safety, legal and cultural issues relevant to professional engineering practice.'),
  ('baete-po7', 'BAETE', 'PO7', 'Environment and sustainability', 'পরিবেশ ও টেকসই উন্নয়ন', 'Understand and evaluate the sustainability and impact of professional engineering work in societal and environmental contexts.'),
  ('baete-po8', 'BAETE', 'PO8', 'Ethics', 'নৈতিকতা', 'Apply ethical principles and commit to professional ethics, responsibilities and the norms of engineering practice.'),
  ('baete-po9', 'BAETE', 'PO9', 'Individual work and teamwork', 'একক ও দলগত কাজ', 'Function effectively as an individual, and as a member or leader in diverse teams and in multidisciplinary settings.'),
  ('baete-po10', 'BAETE', 'PO10', 'Communication', 'যোগাযোগ', 'Communicate effectively on complex engineering activities with the engineering community and with society at large.'),
  ('baete-po11', 'BAETE', 'PO11', 'Project management and finance', 'প্রকল্প ব্যবস্থাপনা ও অর্থায়ন', 'Demonstrate knowledge and understanding of engineering management principles and economic decision-making, and apply these to manage projects.'),
  ('baete-po12', 'BAETE', 'PO12', 'Life-long learning', 'আজীবন শিক্ষা', 'Recognise the need for, and have the preparation and ability to engage in, independent and life-long learning.')
ON CONFLICT (framework, code) DO NOTHING;

CREATE TABLE IF NOT EXISTS event_outcomes (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  po_code TEXT NOT NULL,
  weight INTEGER NOT NULL CHECK (weight BETWEEN 1 AND 3),
  tagged_by TEXT REFERENCES users(id),
  tagged_at TEXT NOT NULL,
  PRIMARY KEY (event_id, po_code)
);

CREATE TABLE IF NOT EXISTS role_outcomes (
  club_role TEXT NOT NULL,
  po_code TEXT NOT NULL,
  weight INTEGER NOT NULL CHECK (weight BETWEEN 1 AND 3),
  PRIMARY KEY (club_role, po_code)
);

INSERT INTO role_outcomes (club_role, po_code, weight) VALUES
  ('PRESIDENT', 'PO9', 3), ('PRESIDENT', 'PO11', 2), ('PRESIDENT', 'PO10', 1),
  ('TREASURER', 'PO11', 3), ('TREASURER', 'PO9', 1),
  ('EXECUTIVE', 'PO9', 2), ('EXECUTIVE', 'PO10', 1),
  ('MEMBER', 'PO9', 1)
ON CONFLICT (club_role, po_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS reflections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, event_id)
);

-- Issued transcript snapshots, verifiable publicly by id (masked).
CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_at TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  jws TEXT
);

CREATE INDEX IF NOT EXISTS idx_event_outcomes_po ON event_outcomes(po_code);
CREATE INDEX IF NOT EXISTS idx_reflections_user ON reflections(user_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_user ON transcripts(user_id);
