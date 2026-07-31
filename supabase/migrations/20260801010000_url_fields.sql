-- デート / やりたいこと / カレンダーの予定に参考リンク(URL)を貼れるようにする
-- 例: 行きたいお店の食べログ、映画の公式サイト、ほしいものの商品ページ
ALTER TABLE dates  ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE wishes ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS url text;

-- 予定 → デートへのエクスポート元を辿れるようにする (二重エクスポート防止にも使う)
ALTER TABLE dates ADD COLUMN IF NOT EXISTS from_event_id bigint;
