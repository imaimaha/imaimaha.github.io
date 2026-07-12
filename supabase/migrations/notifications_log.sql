-- notifications_log: send-push で送信された通知を受信者ごとに永続化
-- お知らせセンター用。既読管理・履歴閲覧を可能にする
CREATE TABLE IF NOT EXISTS public.notifications_log (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      uuid REFERENCES auth.users NOT NULL,  -- 受信者
  sender_id    uuid REFERENCES auth.users,           -- 送信者（scheduled 等の場合 null）
  title        text NOT NULL,
  body         text NOT NULL,
  url          text,
  kind         text,                                 -- 'thanks','gacha','shop','capsule' 等（任意）
  read_at      timestamptz,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_log_user_created
  ON public.notifications_log(user_id, created_at DESC);

ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_log_select ON public.notifications_log;
CREATE POLICY notifications_log_select ON public.notifications_log
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_log_update ON public.notifications_log;
CREATE POLICY notifications_log_update ON public.notifications_log
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_log_delete ON public.notifications_log;
CREATE POLICY notifications_log_delete ON public.notifications_log
  FOR DELETE USING (auth.uid() = user_id);

-- INSERT は service_role からのみ (send-push Edge Function)
GRANT SELECT, UPDATE, DELETE ON public.notifications_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.notifications_log_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.notifications_log_id_seq TO service_role;
