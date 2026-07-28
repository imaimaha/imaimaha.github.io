-- ふたりの日記: 相手の日記へのスタンプ反応 (1人1エントリ1スタンプ、再タップで解除)
CREATE TABLE IF NOT EXISTS diary_reactions (
  entry_id   uuid NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  emoji      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, user_id)
);

ALTER TABLE diary_reactions ENABLE ROW LEVEL SECURITY;

-- SELECT は全員 (お互いのスタンプが見える)。書き込みは自分の分のみ
DROP POLICY IF EXISTS diary_reactions_select ON diary_reactions;
CREATE POLICY diary_reactions_select ON diary_reactions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS diary_reactions_insert ON diary_reactions;
CREATE POLICY diary_reactions_insert ON diary_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS diary_reactions_update ON diary_reactions;
CREATE POLICY diary_reactions_update ON diary_reactions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS diary_reactions_delete ON diary_reactions;
CREATE POLICY diary_reactions_delete ON diary_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON diary_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON diary_reactions TO service_role;

CREATE INDEX IF NOT EXISTS diary_reactions_entry_idx ON diary_reactions (entry_id);
