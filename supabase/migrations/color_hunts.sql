-- カラーハンティング（色を指定して、その色のものを8枚の写真でハント）
CREATE TABLE IF NOT EXISTS color_hunts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode        TEXT NOT NULL,         -- 'weekly' | 'single'
  week_key    TEXT,                  -- weekly の場合: YYYY-MM-DD (月曜)
  color_hex   TEXT NOT NULL,         -- '#FF5733'
  color_name  TEXT,                  -- '朱色'
  photos      JSONB NOT NULL DEFAULT '[]',  -- [{path, uploaded_at, position, memo}]
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_color_hunts_user_mode
  ON color_hunts (user_id, mode, week_key);

ALTER TABLE color_hunts ENABLE ROW LEVEL SECURITY;

-- 2人共有で閲覧・自分の分だけ書き込み
CREATE POLICY "color_hunts_select_all" ON color_hunts
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "color_hunts_insert_own" ON color_hunts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "color_hunts_update_own" ON color_hunts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "color_hunts_delete_own" ON color_hunts
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON color_hunts TO authenticated;
