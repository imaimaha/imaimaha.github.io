-- ふたりの日記 (ほぼ日みたいな): 1人1日1件、お互いに見える共有日記
CREATE TABLE IF NOT EXISTS diary_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  date_str   text NOT NULL,      -- JST日付 YYYY-MM-DD
  mood       text,               -- 天気/きもち絵文字 (任意)
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date_str)
);

ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diary_entries_select ON diary_entries;
CREATE POLICY diary_entries_select ON diary_entries FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS diary_entries_insert ON diary_entries;
CREATE POLICY diary_entries_insert ON diary_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS diary_entries_update ON diary_entries;
CREATE POLICY diary_entries_update ON diary_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON diary_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON diary_entries TO service_role;
