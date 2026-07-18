-- ふたりのオルゴール工房: 自作メロディの保存・共有
-- notes は [[step, pitchIndex], ...] の jsonb。step 0..steps-1 / pitchIndex はスケール配列の添字
CREATE TABLE IF NOT EXISTS melodies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,           -- 作者 (profiles への FK は張らない)
  title text,
  bpm int NOT NULL DEFAULT 112,
  steps int NOT NULL DEFAULT 32,
  scale text NOT NULL DEFAULT 'c_pentatonic',
  notes jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS melodies_created_idx ON melodies (created_at DESC);

ALTER TABLE melodies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mel_select ON melodies;
CREATE POLICY mel_select ON melodies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS mel_insert ON melodies;
CREATE POLICY mel_insert ON melodies FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS mel_update ON melodies;
CREATE POLICY mel_update ON melodies FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS mel_delete ON melodies;
CREATE POLICY mel_delete ON melodies FOR DELETE TO authenticated USING (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON melodies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON melodies TO service_role;

-- 💖 リアクション (1人1曲につき1つ)
CREATE TABLE IF NOT EXISTS melody_reactions (
  melody_id uuid NOT NULL REFERENCES melodies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL DEFAULT '💖',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (melody_id, user_id)
);
ALTER TABLE melody_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mr_select ON melody_reactions;
CREATE POLICY mr_select ON melody_reactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS mr_insert ON melody_reactions;
CREATE POLICY mr_insert ON melody_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS mr_delete ON melody_reactions;
CREATE POLICY mr_delete ON melody_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON melody_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON melody_reactions TO service_role;
