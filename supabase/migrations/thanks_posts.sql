-- 相手への「ありがとう」ポスト
CREATE TABLE IF NOT EXISTS thanks_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thanks_created ON thanks_posts (created_at DESC);

ALTER TABLE thanks_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "thanks_select"      ON thanks_posts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "thanks_insert_own"  ON thanks_posts FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "thanks_delete_own"  ON thanks_posts FOR DELETE USING (auth.uid() = from_user_id);

GRANT SELECT, INSERT, DELETE ON thanks_posts TO authenticated;
