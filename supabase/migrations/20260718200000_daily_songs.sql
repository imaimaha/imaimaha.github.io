-- One Song a Day: 毎日ひとつだけ音楽・動画・ポッドキャスト等を相手に共有する機能
-- 1人1日1曲 (unique user_id+date_str)。同じ日に貼り直すと upsert で差し替わる。
CREATE TABLE IF NOT EXISTS daily_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date_str text NOT NULL,        -- JST YYYY-MM-DD
  url text NOT NULL,
  service text,                  -- youtube / spotify / apple / podcast / soundcloud / other
  title text,
  author text,
  thumbnail text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date_str)
);
CREATE INDEX IF NOT EXISTS daily_songs_date_idx ON daily_songs (date_str DESC);

ALTER TABLE daily_songs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ds_select ON daily_songs;
CREATE POLICY ds_select ON daily_songs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ds_insert ON daily_songs;
CREATE POLICY ds_insert ON daily_songs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS ds_update ON daily_songs;
CREATE POLICY ds_update ON daily_songs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS ds_delete ON daily_songs;
CREATE POLICY ds_delete ON daily_songs FOR DELETE TO authenticated USING (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_songs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_songs TO service_role;

-- リアクション (相手の曲に 💖 等を返す)。1人1曲につき1リアクション。
CREATE TABLE IF NOT EXISTS song_reactions (
  song_id uuid NOT NULL REFERENCES daily_songs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (song_id, user_id)
);
ALTER TABLE song_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sr_select ON song_reactions;
CREATE POLICY sr_select ON song_reactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS sr_insert ON song_reactions;
CREATE POLICY sr_insert ON song_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS sr_update ON song_reactions;
CREATE POLICY sr_update ON song_reactions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS sr_delete ON song_reactions;
CREATE POLICY sr_delete ON song_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON song_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON song_reactions TO service_role;
