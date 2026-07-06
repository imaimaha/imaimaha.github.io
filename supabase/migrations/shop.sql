-- ポイント販売所: 相手に商品を出品→相手が pt で購入→ pt が移動
CREATE TABLE IF NOT EXISTS shop_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  emoji           TEXT NOT NULL,
  description     TEXT,
  price           INTEGER NOT NULL CHECK (price > 0),
  stock           INTEGER,                       -- null = 無限
  bonus_points    INTEGER,                       -- ポイント券タイプ (使用時に付与)
  rarity          TEXT CHECK (rarity IN ('N','R','SR') OR rarity IS NULL),
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_items_buyer ON shop_items (buyer_id, active);
CREATE INDEX IF NOT EXISTS idx_shop_items_seller ON shop_items (seller_id);

ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop_items_select"     ON shop_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "shop_items_insert_own" ON shop_items FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "shop_items_update_own" ON shop_items FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "shop_items_delete_own" ON shop_items FOR DELETE USING (auth.uid() = seller_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON shop_items TO authenticated;

CREATE TABLE IF NOT EXISTS shop_purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID REFERENCES shop_items(id) ON DELETE SET NULL,
  buyer_id        UUID NOT NULL REFERENCES auth.users(id),
  seller_id       UUID NOT NULL REFERENCES auth.users(id),
  price           INTEGER NOT NULL,
  name            TEXT NOT NULL,     -- snapshot
  emoji           TEXT NOT NULL,
  description     TEXT,
  bonus_points    INTEGER,
  rarity          TEXT,
  used            BOOLEAN NOT NULL DEFAULT false,
  purchased_at    TIMESTAMPTZ DEFAULT NOW(),
  used_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shop_purchases_buyer ON shop_purchases (buyer_id, used);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_seller ON shop_purchases (seller_id);

ALTER TABLE shop_purchases ENABLE ROW LEVEL SECURITY;
-- 認証済みユーザーは全 SELECT (自分・相手の購入両方見える)
CREATE POLICY "shop_purchases_select" ON shop_purchases FOR SELECT USING (auth.uid() IS NOT NULL);
-- INSERT/UPDATE は Edge Function (service_role) が担う (原子性のため)
-- 使用済み更新は buyer だけ許可
CREATE POLICY "shop_purchases_update_own" ON shop_purchases FOR UPDATE USING (auth.uid() = buyer_id);
GRANT SELECT, UPDATE ON shop_purchases TO authenticated;
