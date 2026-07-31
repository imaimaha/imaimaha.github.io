-- リクエストの宛先: 'shop' = 販売所に出品してほしい / 'gacha' = ガチャの景品に入れてほしい
-- 既存行はすべて販売所向けとして 'shop' にする
ALTER TABLE shop_requests ADD COLUMN IF NOT EXISTS target text NOT NULL DEFAULT 'shop';
