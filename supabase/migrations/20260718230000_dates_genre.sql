-- デートにジャンル (フォトミッションの出題プール選択用)
ALTER TABLE dates ADD COLUMN IF NOT EXISTS genre text;
