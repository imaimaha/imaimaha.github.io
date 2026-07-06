-- push_subscriptions.id が bigint autoincrement のため、authenticated が INSERT する時に
-- 内部で使う sequence にも権限が必要。テーブルへの GRANT だけでは足りない。
GRANT USAGE, SELECT ON SEQUENCE push_subscriptions_id_seq TO authenticated;
