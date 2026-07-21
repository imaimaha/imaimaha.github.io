-- 筋トレしよ！: 日替わり3stepクエスト。step1/2は自己申告のみで個別クリア、
-- step3は二人ともクリアして初めてポイント付与される (workout_awards で一度きりに制御)

CREATE TABLE IF NOT EXISTS workout_clears (
  date_str   text        NOT NULL,
  user_id    uuid        NOT NULL,
  step       smallint    NOT NULL CHECK (step IN (1,2,3)),
  cleared_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (date_str, user_id, step)
);

ALTER TABLE workout_clears ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workout_clears_select ON workout_clears;
CREATE POLICY workout_clears_select ON workout_clears
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 自分の分のみクリア記録可 (自己申告なので他人の分は代理不可)
DROP POLICY IF EXISTS workout_clears_insert ON workout_clears;
CREATE POLICY workout_clears_insert ON workout_clears
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON workout_clears TO authenticated;
GRANT SELECT, INSERT ON workout_clears TO service_role;

-- step3 両者クリア時のポイント付与を一度きりにするための排他ガード。
-- INSERT ... ON CONFLICT DO NOTHING で先着1件だけが権利を得る (RETURNING行が返った側が付与処理を実行)
CREATE TABLE IF NOT EXISTS workout_awards (
  date_str         text PRIMARY KEY,
  step3_awarded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workout_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workout_awards_select ON workout_awards;
CREATE POLICY workout_awards_select ON workout_awards
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS workout_awards_insert ON workout_awards;
CREATE POLICY workout_awards_insert ON workout_awards
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT ON workout_awards TO authenticated;
GRANT SELECT, INSERT ON workout_awards TO service_role;
