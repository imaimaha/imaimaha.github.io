-- ガチャ相手ラインナップ機能:
-- 自分(added_by) が 相手(target_user_id) のガチャに景品を追加できる
CREATE TABLE IF NOT EXISTS gacha_custom_prizes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  added_by        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  emoji           TEXT NOT NULL,
  rarity          TEXT NOT NULL CHECK (rarity IN ('N', 'R', 'SR')),
  description     TEXT,
  bonus_points    INTEGER,
  weight          NUMERIC NOT NULL DEFAULT 1,  -- カスタムプール内の相対重み
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gacha_custom_target
  ON gacha_custom_prizes (target_user_id, active);
CREATE INDEX IF NOT EXISTS idx_gacha_custom_added_by
  ON gacha_custom_prizes (added_by);

ALTER TABLE gacha_custom_prizes ENABLE ROW LEVEL SECURITY;

-- 認証済み全員が SELECT 可（対象者はガチャで抽選するため必要、追加者は自分の追加確認のため）
CREATE POLICY "gacha_custom_select" ON gacha_custom_prizes
  FOR SELECT USING (auth.uid() IS NOT NULL);
-- 追加者本人のみ INSERT/UPDATE/DELETE 可
CREATE POLICY "gacha_custom_insert_own" ON gacha_custom_prizes
  FOR INSERT WITH CHECK (auth.uid() = added_by);
CREATE POLICY "gacha_custom_update_own" ON gacha_custom_prizes
  FOR UPDATE USING (auth.uid() = added_by);
CREATE POLICY "gacha_custom_delete_own" ON gacha_custom_prizes
  FOR DELETE USING (auth.uid() = added_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON gacha_custom_prizes TO authenticated;

-- カスタム景品プールの割合(0.0〜1.0) をガチャオーナー(自分)側の設定として保持
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gacha_custom_share NUMERIC NOT NULL DEFAULT 0.5
  CHECK (gacha_custom_share >= 0 AND gacha_custom_share <= 1);
