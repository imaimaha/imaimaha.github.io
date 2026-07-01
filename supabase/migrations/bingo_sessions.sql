-- お散歩ビンゴ用テーブル
-- Supabase ダッシュボード → SQL Editor で実行してください

CREATE TABLE IF NOT EXISTS bingo_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode        TEXT NOT NULL,          -- 'daily' | 'category' | 'random'
  label       TEXT,                   -- 表示名（カテゴリー名・難易度など）
  date_str    TEXT,                   -- 今日だけビンゴ用: 'YYYY-MM-DD'
  items       JSONB NOT NULL,         -- [{text, is_lucky}]
  checks      JSONB NOT NULL DEFAULT '[]', -- [{index, memo, checked_at}]
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス（今日のビンゴ高速検索用）
CREATE INDEX IF NOT EXISTS idx_bingo_user_daily
  ON bingo_sessions (user_id, mode, date_str);

-- RLS
ALTER TABLE bingo_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bingo_own_records" ON bingo_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
