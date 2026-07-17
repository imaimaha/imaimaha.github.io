-- アカウント別・種類別のプッシュ通知 ON/OFF 設定
-- opt-out 方式: 行が無ければ「受け取る(有効)」。OFF にした種類だけ行が残る。
-- 通知の履歴(notifications_log)は設定に関わらず常に記録される。プッシュ配信だけを制御する。

-- user_id は profiles への FK を張らない。profiles 行を持たない認証ユーザー
-- (テスト用アカウント等) でも設定を保存できるようにするため。profiles は削除されない運用。
CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id uuid NOT NULL,
  kind    text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind)
);

ALTER TABLE notification_prefs ENABLE ROW LEVEL SECURITY;

-- 全員が閲覧可(2人だけの信頼モデル)。書き込みは自分の分のみ。
DROP POLICY IF EXISTS np_select ON notification_prefs;
CREATE POLICY np_select ON notification_prefs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS np_insert ON notification_prefs;
CREATE POLICY np_insert ON notification_prefs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS np_update ON notification_prefs;
CREATE POLICY np_update ON notification_prefs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS np_delete ON notification_prefs;
CREATE POLICY np_delete ON notification_prefs FOR DELETE TO authenticated USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON notification_prefs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_prefs TO service_role;
