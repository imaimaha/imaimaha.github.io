-- ふたりの日記: 連続記入ボーナス用の一度きり付与ガード
CREATE TABLE IF NOT EXISTS diary_streak_awards (
  user_id     uuid NOT NULL,
  milestone   integer NOT NULL,
  awarded_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, milestone)
);

ALTER TABLE diary_streak_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diary_streak_awards_select ON diary_streak_awards;
CREATE POLICY diary_streak_awards_select ON diary_streak_awards FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS diary_streak_awards_insert ON diary_streak_awards;
CREATE POLICY diary_streak_awards_insert ON diary_streak_awards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON diary_streak_awards TO authenticated;
GRANT SELECT, INSERT ON diary_streak_awards TO service_role;
