-- 帰宅ステータス関連の操作ログ
-- 帰宅時間設定 / 遅れそう / 会社出た / 帰宅 / 行きたい / 来てほしい / いいよ 等を時系列で残す
CREATE TABLE IF NOT EXISTS status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,       -- set_time / late / left / home / want_go / want_come / ok
  detail text,              -- 補足 (例: 設定した時刻)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS status_events_created_idx ON status_events (created_at DESC);

ALTER TABLE status_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS se_select ON status_events;
CREATE POLICY se_select ON status_events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS se_insert ON status_events;
CREATE POLICY se_insert ON status_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT ON status_events TO authenticated;
GRANT SELECT, INSERT ON status_events TO service_role;
