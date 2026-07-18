-- ふたりのデート (dates) + カウントダウン (countdowns)
-- どちらも uuid PK なので sequence GRANT は不要。

-- ============================================================
-- カウントダウン: 記念日・誕生日・カスタムの節目までの残り日数を管理
-- 記念日(交際開始)は index.html でコード定義のため、ここには入れない。
-- recurring='yearly' は毎年の同じ月日、'none' は一度きり(過ぎたら履歴)
-- ============================================================
CREATE TABLE IF NOT EXISTS countdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  emoji text NOT NULL DEFAULT '📌',
  target_date date NOT NULL,           -- 対象の月日(yearly は年は無視して月日で運用)
  recurring text NOT NULL DEFAULT 'none',  -- 'none' | 'yearly'
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS countdowns_date_idx ON countdowns (target_date);

ALTER TABLE countdowns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cd_select ON countdowns;
CREATE POLICY cd_select ON countdowns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS cd_insert ON countdowns;
CREATE POLICY cd_insert ON countdowns FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS cd_update ON countdowns;
CREATE POLICY cd_update ON countdowns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS cd_delete ON countdowns;
CREATE POLICY cd_delete ON countdowns FOR DELETE TO authenticated USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON countdowns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON countdowns TO service_role;

-- ============================================================
-- デート本体: 1回のデート。計画中(planned) → 実施済み(done)
-- missions: フォトミッション(お題)を作成時にプールからランダム付与した文字列配列
-- ============================================================
CREATE TABLE IF NOT EXISTS dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  date_str text NOT NULL,              -- JST YYYY-MM-DD (予定日 / 実施日)
  place text,
  memo text,
  status text NOT NULL DEFAULT 'planned',  -- 'planned' | 'done'
  missions jsonb NOT NULL DEFAULT '[]'::jsonb,  -- ["空を大きく入れて撮る", ...]
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dates_date_idx ON dates (date_str DESC);

ALTER TABLE dates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dt_select ON dates;
CREATE POLICY dt_select ON dates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS dt_insert ON dates;
CREATE POLICY dt_insert ON dates FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
-- 2人の共有物なので更新・削除はどちらも可
DROP POLICY IF EXISTS dt_update ON dates;
CREATE POLICY dt_update ON dates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS dt_delete ON dates;
CREATE POLICY dt_delete ON dates FOR DELETE TO authenticated USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON dates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON dates TO service_role;

-- ============================================================
-- デートの写真: memories bucket の date_photos/<date_id>/<user_id>/ に実体
-- mission が非NULL なら「そのフォトミッション達成の1枚」。is_best は各自1枚のベストショット
-- ============================================================
CREATE TABLE IF NOT EXISTS date_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_id uuid NOT NULL REFERENCES dates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  path text NOT NULL,
  caption text,
  mission text,                        -- 達成したフォトミッション文言 (自由投稿は NULL)
  is_best boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS date_photos_date_idx ON date_photos (date_id);

ALTER TABLE date_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dp_select ON date_photos;
CREATE POLICY dp_select ON date_photos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS dp_insert ON date_photos;
CREATE POLICY dp_insert ON date_photos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
-- ベストショット切替は相手の写真にも付けられるよう update は全許可
DROP POLICY IF EXISTS dp_update ON date_photos;
CREATE POLICY dp_update ON date_photos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS dp_delete ON date_photos;
CREATE POLICY dp_delete ON date_photos FOR DELETE TO authenticated USING (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON date_photos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON date_photos TO service_role;

-- ============================================================
-- デートへのコメント (お互いのスレッド)
-- ============================================================
CREATE TABLE IF NOT EXISTS date_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_id uuid NOT NULL REFERENCES dates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS date_comments_date_idx ON date_comments (date_id, created_at);

ALTER TABLE date_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dc_select ON date_comments;
CREATE POLICY dc_select ON date_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS dc_insert ON date_comments;
CREATE POLICY dc_insert ON date_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS dc_delete ON date_comments;
CREATE POLICY dc_delete ON date_comments FOR DELETE TO authenticated USING (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON date_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON date_comments TO service_role;

-- ============================================================
-- デートのふり返り (1人1デート1件・星評価+ひとこと)
-- ============================================================
CREATE TABLE IF NOT EXISTS date_reviews (
  date_id uuid NOT NULL REFERENCES dates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating int NOT NULL DEFAULT 5,       -- 1〜5
  body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (date_id, user_id)
);

ALTER TABLE date_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dr_select ON date_reviews;
CREATE POLICY dr_select ON date_reviews FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS dr_insert ON date_reviews;
CREATE POLICY dr_insert ON date_reviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS dr_update ON date_reviews;
CREATE POLICY dr_update ON date_reviews FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS dr_delete ON date_reviews;
CREATE POLICY dr_delete ON date_reviews FOR DELETE TO authenticated USING (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON date_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON date_reviews TO service_role;
