-- shop_requests: authenticated / service_role への基本権限 GRANT
-- (テーブル作成時に漏れていて "機能準備中です" fallback が出ていた)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_requests TO service_role;
