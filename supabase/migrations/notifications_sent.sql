-- リマインダーの重複防止用: (user_id, kind, date_str) の一意記録
CREATE TABLE IF NOT EXISTS notifications_sent (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,   -- 'status_1719' | 'status_1901' | 'quiz_evening' | 'capsule_morning' | 'bingo_saturday' | 'color_saturday' | 'gauge_low' | 'anniversary_countdown' etc.
  date_str    TEXT NOT NULL,   -- 'YYYY-MM-DD' (JST)
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, kind, date_str)
);

CREATE INDEX IF NOT EXISTS idx_notif_user_kind_date ON notifications_sent (user_id, kind, date_str);

ALTER TABLE notifications_sent ENABLE ROW LEVEL SECURITY;
-- クライアントからは読取のみ、書込は Edge Function (service role) のみ
CREATE POLICY "notif_select" ON notifications_sent FOR SELECT USING (auth.uid() IS NOT NULL);
GRANT SELECT ON notifications_sent TO authenticated;
