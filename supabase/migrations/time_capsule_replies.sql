-- タイムカプセルのスレッド返信: replies を jsonb array で持つ
-- [{ user_id, text, created_at }]
ALTER TABLE time_capsules
  ADD COLUMN IF NOT EXISTS replies JSONB NOT NULL DEFAULT '[]';

-- 返信するにはカプセルの更新権限が必要。既存 policy を確認して足す。
-- sender/recipient 両方が返信できるように、専用の update policy を追加
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='time_capsules' AND policyname='capsule_replies_update') THEN
    CREATE POLICY "capsule_replies_update" ON time_capsules
      FOR UPDATE USING (auth.uid() IN (sender_id, recipient_id));
  END IF;
END $$;
