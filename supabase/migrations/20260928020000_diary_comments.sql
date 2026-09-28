-- ふたりの日記: 相手の日記への一言テキストコメント (スタンプ反応とは別。1人1エントリ1コメント、編集・削除可)
CREATE TABLE IF NOT EXISTS diary_comments (
  entry_id   uuid NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, user_id)
);

ALTER TABLE diary_comments ENABLE ROW LEVEL SECURITY;

-- SELECT は全員 (お互いのコメントが見える)。書き込みは自分の分のみ
DROP POLICY IF EXISTS diary_comments_select ON diary_comments;
CREATE POLICY diary_comments_select ON diary_comments FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS diary_comments_insert ON diary_comments;
CREATE POLICY diary_comments_insert ON diary_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS diary_comments_update ON diary_comments;
CREATE POLICY diary_comments_update ON diary_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS diary_comments_delete ON diary_comments;
CREATE POLICY diary_comments_delete ON diary_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON diary_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON diary_comments TO service_role;

CREATE INDEX IF NOT EXISTS diary_comments_entry_idx ON diary_comments (entry_id);
